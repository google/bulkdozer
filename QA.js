/***************************************************************************
*
*  Copyright 2020 Google Inc.
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*      https://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*
*  Note that these code samples being shared are not official Google
*  products and are not formally supported.
*
***************************************************************************/

var CUSTOM_URL = 'Custom URL';
var CLICK_TRACKER = 'Click Tracker';

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

      if(placementGroup.pricingSchedule && placementGroup.pricingSchedule.pricingPeriods && placementGroup.pricingSchedule.pricingPeriods.length > 0) {
        feedItem['Rate'] = placementGroup.pricingSchedule.pricingPeriods[0].rateOrCostNanos / 1000000000;
        feedItem['Units'] = placementGroup.pricingSchedule.pricingPeriods[0].units;
      }

      feedItem['Placement Group Type'] = placementGroup.placementGroupType;

      feedItem['Placement Group Start Date'] = getDataUtils().formatDateUserFormat(placementGroup.pricingSchedule.startDate);
      feedItem['Placement Group End Date'] = getDataUtils().formatDateUserFormat(placementGroup.pricingSchedule.endDate);
      feedItem['Pricing Type'] = placementGroup.pricingSchedule.pricingType;
    } else {
      feedItem['Site ID'] = placement.siteId;
    }

    feedItem['Placement Name'] = placement.name;
    feedItem['Placement ID'] = placement.id
    feedItem['Placement Start Date'] = getDataUtils().formatDateUserFormat(placement.pricingSchedule.startDate);
    feedItem['Placement End Date'] = getDataUtils().formatDateUserFormat(placement.pricingSchedule.endDate);
    feedItem['Ad Blocking'] = placement.adBlockingOptOut;
    feedItem['Pricing Schedule Cost Structure'] = placement.pricingSchedule.pricingType;
    feedItem['Type'] = placement.compatibility;

    feedItem['Ad Name'] = ad.name;
    feedItem['Ad ID'] = ad.id;
    feedItem['Ad Type'] = ad.type;
    feedItem['Asset Size'] = ad.size ? ad.size.width + 'x' + ad.size.height : '';
    feedItem['Ad Start Date'] = getDataUtils().formatDateTimeUserFormat(ad.startTime);
    feedItem['Ad End Date'] = getDataUtils().formatDateTimeUserFormat(ad.endTime);
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
      feedItem['Creative Start Date'] = getDataUtils().formatDateTimeUserFormat(creative.startTime);
      feedItem['Creative End Date'] = getDataUtils().formatDateTimeUserFormat(creative.endTime);
      if(creative.landingPage) {
        feedItem['Landing Page Name'] = creative.landingPage.name;
        feedItem['Landing Page URL'] = creative.landingPage.url;
        feedItem['Landing Page ID'] = creative.landingPage.id;
      } else if (creative.clickThroughUrl && creative.clickThroughUrl.customClickThroughUrl) {
        feedItem['Landing Page Name'] = CUSTOM_URL;
        feedItem['Landing Page URL'] = creative.clickThroughUrl.customClickThroughUrl;
      }

      if(ad.weightTotal) {
        feedItem['Creative Rotation %'] = (creative.weight / ad.weightTotal * 100) + '%';
      }
    }

    if(ad.type == 'AD_SERVING_CLICK_TRACKER' && ad.clickThroughUrl &&
        ad.clickThroughUrl.computedClickThroughUrl) {
      feedItem['Landing Page Name'] = CLICK_TRACKER;
      feedItem['Landing Page URL'] = ad.clickThroughUrl.computedClickThroughUrl;
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

    // Campaign
    feedItem['Campaign ID'] = campaign.id;
    feedItem['Campaign Name'] = campaign.name;

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

    feedItem['Placement Start Date'] = getDataUtils().formatDateUserFormat(placement.pricingSchedule.startDate);
    feedItem['Placement End Date'] = getDataUtils().formatDateUserFormat(placement.pricingSchedule.endDate);

    // Ad
    feedItem['Ad Name'] = ad.name;
    //feedItem['Ad Created Date'] = getDataUtils().formatDateTime(ad.createInfo.time);
    feedItem['Ad Created Date'] = getDataUtils().formatDateUserFormat(new Date(parseInt(ad.createInfo.time)));
    feedItem['Ad Last Modified Date'] = getDataUtils().formatDateUserFormat(new Date(parseInt(ad.lastModifiedInfo.time)));

    // Creative
    var creativeNames = [];
    var creativeWeights = [];
    var landingPageNames = [];
    var landingPageUrls = [];

    forEach(ad.creatives, function(index, creative) {
      creativeNames.push(creative.creative.name);

      creativeWeights.push(creative.weight);

      if(creative.landingPage) {
        landingPageNames.push(creative.landingPage.name);
        landingPageUrls.push(creative.landingPage.url);
      } else if(creative.clickThroughUrl && creative.clickThroughUrl.customClickThroughUrl) {
        landingPageNames.push( CUSTOM_URL);
        landingPageUrls.push(creative.clickThroughUrl.customClickThroughUrl);
      }
    });

    if(ad.type == 'AD_SERVING_CLICK_TRACKER' && ad.landingPage) {
      var landingPage = ad.landingPage;

      landingPageNames.push(landingPage.name);
      landingPageUrls.push(landingPage.url);
    }

    feedItem['Creative Names'] = creativeNames.join('\n');
    feedItem['Landing Page Name'] = landingPageNames.join('\n');
    feedItem['Landing Page URL'] = landingPageUrls.join('\n');
    feedItem['Creative Rotation Weight'] = creativeWeights.join('\n');

    feedItem['Creative Rotation'] = getDataUtils().creativeRotationType(ad.creativeRotation);

  });

  new FeedProvider('QA').setFeed(feed).save();
}

/**
    * Implements the Landing Page QA style
    */
function qaLandingPage(job) {
  if(!job.logs) {
    job.logs = [];
  }

  job.logs.push([new Date(), 'Generating QA Report']);

  var feed = [];

  var cmDAO = new CampaignManagerDAO(getProfileId());

  forEach(job.landingPages, function(index, landingPage) {
    var feedItem = {};
    feed.push(feedItem);

    feedItem['Landing Page ID'] = landingPage.id;
    feedItem['Landing Page Name'] = landingPage.name;
    feedItem['Landing Page URL'] = landingPage.url;
    feedItem['Campaign ID'] = landingPage.campaign.id;
    feedItem['Campaign Name'] = landingPage.campaign.name;
  });

  new FeedProvider('QA').setFeed(feed).save();
}
