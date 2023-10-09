/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { Meta, StoryObj } from "@storybook/react";
import { OnerepScanResultRow, OnerepScanRow } from "knex/types/tables";
import { ViewDataBrokersView } from "./View";
import {
  createRandomScanResult,
  createUserWithPremiumSubscription,
} from "../../../../../../../../../apiMocks/mockData";
import { Shell } from "../../../../../../Shell";
import { getEnL10nSync } from "../../../../../../../../functions/server/mockL10n";
import { FixView } from "../../FixView";
import { GuidedExperienceBreaches } from "../../../../../../../../functions/server/getUserBreaches";
import { LatestOnerepScanData } from "../../../../../../../../../db/tables/onerep_scans";

const mockedBreachesEmpty: GuidedExperienceBreaches = {
  emails: [],
  highRisk: {
    bankBreaches: [],
    creditCardBreaches: [],
    pinBreaches: [],
    ssnBreaches: [],
  },
  passwordBreaches: {
    passwords: [],
    securityQuestions: [],
  },
  securityRecommendations: {
    emailAddress: [],
    IPAddress: [],
    phoneNumber: [],
  },
};

const brokerOptions = {
  "no-scan": "No scan started",
  empty: "No scan results",
  "emtpy-scan-in-progress": "Scan is in progress with no results",
  "unresolved-scan-in-progress": "Scan is in progress with unresolved results",
  "unresolved-few": "With a few unresolved scan results",
  "unresolved-many": "With many unresolved scan results",
  resolved: "All scan results resolved",
};
type ViewWrapperProps = {
  brokers: keyof typeof brokerOptions;
  premium: boolean;
};
const ViewWrapper = (props: ViewWrapperProps) => {
  const mockedScan: OnerepScanRow = {
    created_at: new Date(1998, 2, 31),
    updated_at: new Date(1998, 2, 31),
    id: 0,
    onerep_profile_id: 0,
    onerep_scan_id: 0,
    onerep_scan_reason: "initial",
    onerep_scan_status: "finished",
  };
  const mockedScanInProgress: OnerepScanRow = {
    ...mockedScan,
    onerep_scan_status: "in_progress",
  };

  const mockedResolvedScanResults: OnerepScanResultRow[] = [
    createRandomScanResult({ status: "removed" }),
    createRandomScanResult({ status: "waiting_for_verification" }),
    createRandomScanResult({ status: "optout_in_progress" }),
  ];

  const mockedFewUnresolvedScanResults: OnerepScanResultRow[] = [
    ...mockedResolvedScanResults,
    createRandomScanResult({ status: "new", manually_resolved: false }),
    createRandomScanResult({ status: "new", manually_resolved: true }),
  ];

  const mockedManyUnresolvedScanResults: OnerepScanResultRow[] = [
    ...Array(42),
  ].map(() =>
    createRandomScanResult({ status: "new", manually_resolved: false })
  );

  const scanData: LatestOnerepScanData = { scan: null, results: [] };

  if (props.brokers !== "no-scan") {
    scanData.scan =
      props.brokers === "emtpy-scan-in-progress" ||
      props.brokers === "unresolved-scan-in-progress"
        ? mockedScanInProgress
        : mockedScan;

    if (props.brokers === "resolved") {
      scanData.results = mockedResolvedScanResults;
    }
    if (props.brokers === "unresolved-scan-in-progress") {
      scanData.results = mockedFewUnresolvedScanResults;
    }
    if (props.brokers === "unresolved-few") {
      scanData.results = mockedFewUnresolvedScanResults;
    }
    if (props.brokers === "unresolved-many") {
      scanData.results = mockedManyUnresolvedScanResults;
    }
  }

  const user = createUserWithPremiumSubscription();
  if (!props.premium) {
    user.fxa.subscriptions = [];
  }

  const mockedSession = {
    expires: new Date().toISOString(),
    user: user,
  };

  return (
    <Shell
      l10n={getEnL10nSync()}
      session={mockedSession}
      nonce=""
      monthlySubscriptionUrl=""
      yearlySubscriptionUrl=""
    >
      <FixView
        breaches={mockedBreachesEmpty}
        userScannedResults={scanData.results}
      >
        <ViewDataBrokersView scanData={scanData} />
      </FixView>
    </Shell>
  );
};

const meta: Meta<typeof ViewWrapper> = {
  title: "Pages/Guided resolution/1b. Scan results",
  component: ViewWrapper,
  argTypes: {
    brokers: {
      options: Object.keys(brokerOptions),
      description: "Scan results",
      control: {
        type: "radio",
        labels: brokerOptions,
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ViewWrapper>;

export const NoneFree: Story = {
  name: "No scan yet (free)",
  args: {
    brokers: "no-scan",
    premium: false,
  },
};

export const NonePremium: Story = {
  name: "No scan yet (Premium)",
  args: {
    brokers: "no-scan",
    premium: true,
  },
};

export const EmptyFree: Story = {
  name: "No scan results (free)",
  args: {
    brokers: "empty",
    premium: false,
  },
};

export const EmptyPremium: Story = {
  name: "No scan results (Premium)",
  args: {
    brokers: "empty",
    premium: true,
  },
};

export const EmptyInProgressFree: Story = {
  name: "Scan in progress, no results yet (free)",
  args: {
    brokers: "emtpy-scan-in-progress",
    premium: false,
  },
};

export const EmptyInProgressPremium: Story = {
  name: "Scan in progress, no results yet (Premium)",
  args: {
    brokers: "emtpy-scan-in-progress",
    premium: true,
  },
};

export const UnresolvedInProgressFewFree: Story = {
  name: "Scan in progress, some unresolved results already (free)",
  args: {
    brokers: "unresolved-scan-in-progress",
    premium: false,
  },
};

export const UnresolvedInProgressFewPremium: Story = {
  name: "Scan in progress, some unresolved results already (Premium)",
  args: {
    brokers: "unresolved-scan-in-progress",
    premium: true,
  },
};

export const ResolvedFree: Story = {
  name: "All scan results resolved (free)",
  args: {
    brokers: "resolved",
    premium: false,
  },
};

export const ResolvedPremium: Story = {
  name: "All scan results resolved (Premium)",
  args: {
    brokers: "resolved",
    premium: true,
  },
};

export const UnresolvedFewFree: Story = {
  name: "With a few unresolved scan results (free)",
  args: {
    brokers: "unresolved-few",
    premium: false,
  },
};

export const UnresolvedFewPremium: Story = {
  name: "With a few unresolved scan results (Premium)",
  args: {
    brokers: "unresolved-few",
    premium: true,
  },
};

export const UnresolvedManyFree: Story = {
  name: "With many unresolved scan results (free)",
  args: {
    brokers: "unresolved-many",
    premium: false,
  },
};

export const UnresolvedManyPremium: Story = {
  name: "With many unresolved scan results (Premium)",
  args: {
    brokers: "unresolved-many",
    premium: true,
  },
};