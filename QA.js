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

/**
 * Calls function for each ad.
 *
 * parameters:
 *  hierarchy: CM Hierarchy created by buildHierarchy function
 *  func: callback function with the following signature: f(campaign,
 *  placementGroup, placement, ad)
 *  Note: For placements assigned directly to the campaign (i.e. no placement
 *  group) the placementGroup parameter in the callback will be null
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

/**
 * Calls function for each ad creative assignment.
 *
 * parameters:
 *  hierarchy: CM Hierarchy created by buildHierarchy function
 *  func: callback function with the following signature: f(campaign,
 *  placementGroup, placement, ad, creativeAssignment)
 *  Note: For placements assigned directly to the campaign (i.e. no placement
 *  group) the placementGroup parameter in the callback will be null
 */
function forEachAdCreativeAssignment(hierarchy, func) {
  forEach(hierarchy, function(index, campaign) {
    forEach(campaign.placementGroups, function(index, placementGroup) {
      forEach(placementGroup.placements, function(index, placement) {
        forEach(placement.ads, function(index, ad) {
          if(ad.creatives && ad.creatives.length > 0) {
            forEach(ad.creatives, function(index, creative) {
              func(campaign, placementGroup, placement, ad, creative);
            });
          } else {
            func(campaign, placementGroup, placement, ad);
          }
        });
      });
    });

    forEach(campaign.placements, function(index, placement) {
      forEach(placement.ads, function(index, ad) {
        forEach(ad.creatives, function(index, creative) {
          func(campaign, null, placement, ad, creative);
        });
      });
    });
  });
}

/**
 * Implements the Default QA style
 */
function qaByCreativeRotation(job) {
  if(!job.logs) {
    job.logs = [];
  }
  job.logs.push([new Date(), 'Generating QA Report']);

  var feed = [];
  var feed = [];

  var cmDAO = new CampaignManagerDAO(getProfileId());

  forEachAdCreativeAssignment(job.hierarchy, function(campaign, placementGroup, placement, ad, creative) {
    var feedItem = {};

    feedItem['Campaign Name'] = campaign.name;
    feedItem['Campaign ID'] = campaign.id;
    feedItem['Advertiser ID'] = campaign.advertiserId;
    feedItem['Campaign Start Date'] = campaign.startDate;
    feedItem['Campaign End Date'] = campaign.endDate;

    if(placementGroup) {
      feedItem['Placement Group Name'] = placementGroup.name;
      feedItem['Placement Group ID'] = placementGroup.id;

      feedItem['Site ID'] = placementGroup.siteId;

      if(placementGroup.pricingSchedule && placementGroup.pricingSchedule.pricingPeriods.length > 0) {
        feedItem['Rate'] = placementGroup.pricingSchedule.pricingPeriods[0].rateOrCostNanos / 1000000000;
        feedItem['Units'] = placementGroup.pricingSchedule.pricingPeriods[0].units;
      }

      feedItem['Placement Group Type'] = placementGroup.placementGroupType;

      feedItem['Placement Group Start Date'] = placementGroup.pricingSchedule.startDate;
      feedItem['Placement Group End Date'] = placementGroup.pricingSchedule.endDate;
      feedItem['Pricing Type'] = placementGroup.pricingSchedule.pricingType;
    }

    feedItem['Placement Name'] = placement.name;
    feedItem['Placement ID'] = placement.id
    feedItem['Placement Start Date'] = placement.pricingSchedule.startDate;
    feedItem['Placement End Date'] = placement.pricingSchedule.endDate;
    feedItem['Ad Blocking'] = placement.adBlockingOptOut;
    feedItem['Pricing Schedule Cost Structure'] = placement.pricingSchedule.pricingType;
    feedItem['Type'] = placement.compatibility;

    feedItem['Ad Name'] = ad.name;
    feedItem['Ad ID'] = ad.id;
    feedItem['Ad Type'] = ad.type;
    feedItem['Asset Size'] = ad.size ? ad.size.width + 'x' + ad.size.height : '';
    feedItem['Ad Start Date'] = ad.startTime;
    feedItem['Ad End Date'] = ad.endTime;
    if(ad.deliverySchedule) {
      feedItem['Ad Priority'] = ad.deliverySchedule.priority;
    }

    if(ad.targetingTemplateId) {
      var targetingTemplate = cmDAO.get('TargetingTemplates', ad.targetingTemplateId);

      if(targetingTemplate) {
        feedItem['Targeting Template ID'] = targetingTemplate.id;
        feedItem['Targeting Template Name'] = targetingTemplate.name;
      }
    }
    feedItem['Hard Cutoff'] = ad.deliverySchedule ? ad.deliverySchedule.hardCutoff : '';

    if(creative) {
      feedItem['Creative Name'] = creative.creative.name;
      feedItem['Creative ID'] = creative.creative.id;
      feedItem['Creative Size'] = creative.size ? creative.size.width + 'x' + creative.size.height : '';
      feedItem['Creative Rotation Weight'] = creative.weight;
      feedItem['Creative Start Date'] = creative.startTime;
      feedItem['Creative End Date'] = creative.endTime;
      if(creative.landingPage) {
        feedItem['Landing Page Name'] = creative.landingPage.name
        feedItem['Landing Page URL'] = creative.landingPage.url;
        feedItem['Landing Page ID'] = creative.landingPage.id;
      }
    }

    feed.push(feedItem);
  });

  new FeedProvider('QA').setFeed(feed).save();
}

/**
 * Implements the Aggregated Creative Rotation QA style
 */
function qaByAdAggregatedCreativeRotation(job) {

  if(!job.logs) {
    job.logs = [];
  }
  job.logs.push([new Date(), 'Generating QA Report']);

  var feed = [];

  var cmDAO = new CampaignManagerDAO(getProfileId());

  forEachAd(job.hierarchy, function(campaign, placementGroup, placement, ad) {
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

  new FeedProvider('QA').setFeed(feed).save();
}
