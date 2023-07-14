/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import initKnex from "knex";
import knexConfig from "../knexfile.js";
import { ProfileData } from "../../app/functions/server/onerep.js";

const knex = initKnex(knexConfig);

export async function setProfileDetails(
  onerepProfileId: number,
  profileData: ProfileData
) {
  await knex("onerep_profiles").insert({
    onerep_profile_id: onerepProfileId,
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    city_name: profileData.addresses[0]["city"],
    state_code: profileData.addresses[0]["state"],
    date_of_birth: profileData.birth_date,
    created_at: knex.fn.now(),
  });
}