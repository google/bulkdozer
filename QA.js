/*
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     distributed under the License is distributed on an "AS IS" BASIS,
 *     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *     See the License for the specific language governing permissions and
 *     limitations under the License.
 */

function forEachAd(hierarchy, func) {
  forEach(hierarchy, function(index, campaign) {
    forEach(campaign.placementGroups, function(index, placementGroup) {
      forEach(placementGroup.placements, function(index, placement) {
        forEach(placement.ads, function(index, ad) {
          func(campaign, placementGroup, placement, ad);
        });
      });
    });

    forEach(campaign.placements, function(index, placement) {
        forEach(placement.ads, function(index, ad) {
          func(campaign, null, placement, ad);
        });
    });
  });
}

function qaByAdAggregatedCreativeRotation(job) {
  var feed = [];

  var cmDAO = new CampaignManagerDAO(getProfileId());
  var sheetDAO = getSheetDAO();

  forEachAd(job.hierarchy, function(campaign, placementGroup, placement, ad, creative) {
    var feedItem = {};
    feed.push(feedItem);

    var site = cmDAO.get('Sites', placement.siteId);

    // Site
    feedItem['Site Name'] = site.name;

    // Placement
    feedItem['Placement ID'] = placement.id;
    feedItem['Placement Name'] = placement.name;
    if(placement.compatibility == 'IN_STREAM_VIDEO') {
      feedItem['Placement Size'] = 'In stream video';
    } else {
      feedItem['Placement Size'] = placement.size ? placement.size.width + 'x' + placement.size.height : '';
    }

    feedItem['Placement Start Date'] = placement.pricingSchedule.startDate;
    feedItem['Placement End Date'] = placement.pricingSchedule.endDate;

    // Ad
    feedItem['Ad Name'] = ad.name;

    // Creative
    var creativeNames = [];
    var landingPageNames = [];
    var landingPageUrls = [];
    forEach(ad.creatives, function(index, creative) {
      creativeNames.push(creative.creative.name);

      if(creative.landingPage) {
        landingPageNames.push(creative.landingPage.name);
        landingPageUrls.push(creative.landingPage.url);
      }
    });
    feedItem['Creative Names'] = creativeNames.join('\n');
    feedItem['Landing Page Name'] = landingPageNames.join('\n');
    feedItem['Landing Page URL'] = landingPageUrls.join('\n');

    feedItem['Creative Rotation'] = dataUtils.creativeRotationType(ad.creativeRotation);

  });

  sheetDAO.dictToSheet('QA', feed);
}
