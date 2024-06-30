/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { errorIfProduction } from "../../utils/errorThrower";
import { MOCK_ONEREP_BROKERS } from "../config/config";
import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const prodError = errorIfProduction();
  if (prodError) return prodError;

  const page = req.nextUrl.searchParams.get("page") || "1";
  const perPage = req.nextUrl.searchParams.get("per_page") || "100";

  const profileId = req.nextUrl.searchParams.get("profile_id[]");

  if (profileId === null) {
    return NextResponse.json(
      { error: "No 'profile_id' provided!" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    MOCK_ONEREP_BROKERS(Number(profileId), page, perPage),
  );
}
