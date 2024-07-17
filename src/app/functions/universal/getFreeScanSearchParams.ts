/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ExperimentData } from "../../../telemetry/generated/nimbus/experiments";
import { modifyAttributionsForUrlSearchParams } from "../universal/attributions";

export type SearchParamArgs = {
  cookies: {
    attributionsFirstTouch?: string;
  };
  emailInput?: string;
  metricsFlowData?: MetricFlowData;
};

export type MetricFlowParams = {
  entrypointExperiment: string;
  entrypointVariation: string;
  entrypoint: string;
};

export type MetricFlowData = {
  deviceId: string;
  flowId: string;
  flowBeginTime: number;
};

export function getFreeScanSearchParams({
  cookies,
  emailInput,
  entrypoint,
  metricsFlowData,
  experimentData,
}: SearchParamArgs &
  Omit<MetricFlowParams, "entrypointExperiment" | "entrypointVariation"> & {
    experimentData?: ExperimentData;
  }) {
  const attributionSearchParams = modifyAttributionsForUrlSearchParams(
    new URLSearchParams(cookies.attributionsFirstTouch),
    {
      entrypoint,
      form_type: typeof emailInput === "string" ? "email" : "button",
      ...(emailInput && { email: emailInput }),
      ...(metricsFlowData && {
        device_id: metricsFlowData.deviceId,
        flow_id: metricsFlowData.flowId,
        flow_begin_time: metricsFlowData.flowBeginTime.toString(),
      }),
      ...(experimentData &&
        experimentData["landing-page-free-scan-cta"].enabled && {
          entrypoint_experiment: "landing-page-free-scan-cta",
          entrypoint_variation:
            experimentData["landing-page-free-scan-cta"].variant,
        }),
    },
    {
      utm_source: "product",
      utm_medium: "monitor",
      utm_campaign: "get_free_scan",
    },
  );

  return attributionSearchParams.toString();
}
