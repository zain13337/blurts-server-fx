/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The data that is being downloaded in this script is provided by
 * GeoNames (https://www.geonames.org/). We are using the data to compile a set
 * of US cities and states that match the needs of this project. Their work is
 * licensed under a Creative Commons Attribution 4.0 License:
 * https://creativecommons.org/licenses/by/4.0/.
 *
 * All database dumps and table definitions can be found here:
 * https://download.geonames.org/export/dump/.
 */

import https from "https";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

import {
  TAlternateNameData,
  TLocationData,
  IRelevantLocation,
  IRelevantLocationAlternate,
  IDataFileUrls,
} from "./types.d";

const REMOTE_DATA_URL = "https://download.geonames.org/export/dump";
const DATA_COUNTRY_CODE = "US";
const LOCATIONS_DATA_FILE = "locationAutocompleteData.json";
const FETCH_REMOTE_DATASETS = true;
const CLEANUP_TMP_DATA_AFTER_FINISHED = true;

// Only include populated place a city, town, village, or other
// agglomeration of buildings where people live and work.
// Feature classes and codes: http://www.geonames.org/export/codes.html
const allowedFeatureClass = "P";
const allowedFeatureCodes = [
  "PPL",
  "PPLA",
  "PPLA2",
  "PPLA3",
  "PPLA4",
  "PPLC",
  "PPLL",
];

function logProgress(currentCount: number, totalCount: number) {
  const progress = Math.round(((currentCount + 1) / totalCount) * 100);
  process.stdout.write(
    `-> ${totalCount}/${currentCount + 1} (${progress}%) \r`
  );
}

function writeFromRemoteFile({
  url,
  writeStream,
}: {
  url: string;
  writeStream: any;
}) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.on("end", () => {
        resolve(res);
      });
      res.on("error", (error) => {
        reject(error);
      });
      res.pipe(writeStream);
    });
  });
}

async function fetchRemoteArchive({
  remoteArchiveUrl,
  localDownloadPath,
  localExtractionPath,
}: IDataFileUrls) {
  console.info(
    `Downloading remote file: ${remoteArchiveUrl} -> ${localDownloadPath}`
  );

  await writeFromRemoteFile({
    url: remoteArchiveUrl,
    writeStream: createWriteStream(localDownloadPath),
  });

  console.info(`Extracting: ${localDownloadPath} -> ${localExtractionPath}`);
  const zip = new AdmZip(localDownloadPath);
  zip.extractAllTo(localExtractionPath, true);
}

try {
  const startTime = Date.now();
  console.info("Create autocomplete location data");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const tmpDirPath = resolve(__dirname, "tpm-data");

  console.info(`Creating data directory: ${tmpDirPath}`);
  if (!existsSync(tmpDirPath)) {
    mkdirSync(tmpDirPath);
  }

  const localDestinationPath = {
    locations: `${tmpDirPath}/locations-${DATA_COUNTRY_CODE}-extracted`,
    alternateNames: `${tmpDirPath}/alternatenames-${DATA_COUNTRY_CODE}-extracted`,
    hierarchy: `${tmpDirPath}/hierarchy-extracted`,
  };

  if (FETCH_REMOTE_DATASETS) {
    console.info("Downloading all locations");
    await fetchRemoteArchive({
      remoteArchiveUrl: `${REMOTE_DATA_URL}/${DATA_COUNTRY_CODE}.zip`,
      localDownloadPath: `${tmpDirPath}/locations-${DATA_COUNTRY_CODE}.zip`,
      localExtractionPath: localDestinationPath.locations,
    });

    console.info("Downloading alternate names");
    await fetchRemoteArchive({
      remoteArchiveUrl: `${REMOTE_DATA_URL}/alternatenames/${DATA_COUNTRY_CODE}.zip`,
      localDownloadPath: `${tmpDirPath}/alternatenames-${DATA_COUNTRY_CODE}.zip`,
      localExtractionPath: localDestinationPath.alternateNames,
    });

    console.info("Downloading hierachy data");
    await fetchRemoteArchive({
      remoteArchiveUrl: `${REMOTE_DATA_URL}/hierarchy.zip`,
      localDownloadPath: `${tmpDirPath}/hierarchy.zip`,
      localExtractionPath: localDestinationPath.hierarchy,
    });
  } else {
    console.info("Skipping downloading remote data");
  }

  console.info("Reading file: Alternate location names");
  const alternateNamesData = readFileSync(
    `${localDestinationPath.alternateNames}/${DATA_COUNTRY_CODE}.txt`,
    "utf8"
  );

  console.info("Parsing data: Alternate location names");
  const alternateNameRows = alternateNamesData.split("\n");
  const parsedAlternateNames = alternateNameRows
    .map((alternateNamesLine) => {
      const [
        alternateNameId,
        geonameId,
        isolanguage,
        alternateName,
        isPreferredName,
        _isShortName,
        _isColloquial,
        isHistoric,
        _from,
        _to,
      ] = alternateNamesLine.split("\t") as TAlternateNameData; // lines are tab delimited

      const isAbbreviation = isolanguage === "abbr";
      const isRelevantAlternateName =
        (isolanguage === "en" || isAbbreviation) && Number(isHistoric) !== 1;

      if (isRelevantAlternateName) {
        return {
          id: alternateNameId,
          alternateOf: geonameId,
          name: alternateName,
          isPreferredName,
        };
      }

      return null;
    })
    .filter(
      (alternateName) => alternateName
    ) as Array<IRelevantLocationAlternate>;

  console.info("Reading file: Hierarchy");
  const hierachyData = readFileSync(
    `${localDestinationPath.hierarchy}/hierarchy.txt`,
    "utf8"
  );
  console.info("Parsing data: Location hierarchy");
  const hierachyDataRows = hierachyData.split("\n");
  const hierarchyIds = hierachyDataRows.map((hierachyRow) => {
    const [locationParentId, locationChildId, _hierachyType] =
      hierachyRow.split("\t");

    return [locationParentId, locationChildId];
  });

  console.info("Reading file: All locations");
  const locationData = readFileSync(
    `${localDestinationPath.locations}/${DATA_COUNTRY_CODE}.txt`,
    "utf8"
  );

  console.info("Parsing data: All locations");
  const locationDataRows = locationData.split("\n");
  const locationRowCount = locationDataRows.length;
  const locationDataPopulated: Array<IRelevantLocation> =
    locationDataRows.reduce((relevantLocations, location, rowIndex) => {
      logProgress(rowIndex, locationRowCount);

      const [
        geonameId,
        name,
        _asciiname,
        _alternatenames,
        _latitude,
        _longitude,
        featureClass,
        featureCode,
        _countryCode,
        _cc2,
        admin1Code,
        _admin2Code,
        _admin3Code,
        _admin4Code,
        population,
        _elevation,
        _dem,
        _timezone,
        _modificationDate,
      ] = location.split("\t") as TLocationData; // lines are tab delimited

      const isPopulatedPlaceOfInterest =
        featureClass === allowedFeatureClass &&
        allowedFeatureCodes.includes(featureCode);
      const hasPopulation = Number(population) !== 0;

      if (isPopulatedPlaceOfInterest && hasPopulation) {
        const alternateNames = parsedAlternateNames.filter(
          ({ alternateOf, name: alternateName }) =>
            alternateOf === geonameId && alternateName !== name
        );
        const preferredName = alternateNames.find(
          ({ isPreferredName }) => isPreferredName === "1"
        );
        const alternateNamesFinal = alternateNames.map((alternateName) => {
          // Include the original name as an alternative name if we’ll use an
          // alternate name that is the preferred name.
          if (preferredName && preferredName.name === alternateName.name) {
            return name;
          }

          return alternateName.name;
        });

        relevantLocations.push({
          id: geonameId,
          // switch names if an alternate name is the preferred location name
          name: preferredName ? preferredName.name : name,
          stateCode: admin1Code,
          countryCode: "USA",
          featureClass,
          featureCode,
          population,
          ...(alternateNames &&
            alternateNames.length > 0 && {
              alternateNames: alternateNamesFinal,
            }),
        });
      }

      return relevantLocations;
    }, Array());

  // Filter out locations that have another populated place as a parent.
  console.info("Filtering by hierachy");
  const locationDataPopulatedCount = locationDataPopulated.length;
  const locationDataPopulatedTopLevel = locationDataPopulated.filter(
    (locationPopulated, rowIndex) => {
      logProgress(rowIndex, locationDataPopulatedCount);

      const hasPopulatedParentLocation = hierarchyIds.some(
        ([parentId, childId]) => {
          if (locationPopulated.id === childId) {
            return locationDataPopulated.some((location) => {
              if (
                location.id === parentId &&
                location.featureClass === allowedFeatureClass
              ) {
                return true;
              }
              return false;
            });
          }
          return false;
        }
      );

      return !hasPopulatedParentLocation;
    }
  );

  console.info(
    `Number of relevant locations found: ${locationDataPopulatedTopLevel.length}`
  );

  console.info(`Writing location data to file: ${LOCATIONS_DATA_FILE}`);
  writeFileSync(
    LOCATIONS_DATA_FILE,
    JSON.stringify(locationDataPopulatedTopLevel)
  );

  if (CLEANUP_TMP_DATA_AFTER_FINISHED) {
    console.info("Cleaning up data directory");
    rmSync(tmpDirPath, {
      recursive: true,
      force: true,
    });
  }

  const endTime = Date.now();
  console.info(
    `Created location data file successfully: Executed in ${
      (endTime - startTime) / 1000
    }s`
  );
} catch (error) {
  console.error("Creating location file failed with:", error);
}

process.exit();
