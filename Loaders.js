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

var DataUtils = function() {
  this.creativeRotationType = function(creativeRotation) {
    if (creativeRotation) {
      if (creativeRotation.type == 'CREATIVE_ROTATION_TYPE_SEQUENTIAL' &&
          !creativeRotation.weightCalculationStrategy) {
        return 'SEQUENTIAL';
      } else if (
          creativeRotation.type == 'CREATIVE_ROTATION_TYPE_RANDOM' &&
          creativeRotation.weightCalculationStrategy ==
              'WEIGHT_STRATEGY_EQUAL') {
        return 'EVEN'
      } else if (
          creativeRotation.type == 'CREATIVE_ROTATION_TYPE_RANDOM' &&
          creativeRotation.weightCalculationStrategy ==
              'WEIGHT_STRATEGY_CUSTOM') {
        return 'CUSTOM'
      } else if (
          creativeRotation.type == 'CREATIVE_ROTATION_TYPE_RANDOM' &&
          creativeRotation.weightCalculationStrategy ==
              'WEIGHT_STRATEGY_HIGHEST_CTR') {
        return 'CLICK-THROUGH RATE'
      } else if (
          creativeRotation.type == 'CREATIVE_ROTATION_TYPE_RANDOM' &&
          creativeRotation.weightCalculationStrategy ==
              'WEIGHT_STRATEGY_OPTIMIZED') {
        return 'OPTIMIZED'
      }
    }
  }

  this.formatDateTime = function(value) {
    if(typeof(value) == 'string') {
      return Utilities.formatDate(new Date(value), 'GMT', "yyyy-MM-dd'T'HH:mm:ssZ");
    } else if(value) {
      return Utilities.formatDate(value, SpreadsheetApp.getActive().getSpreadsheetTimeZone(),  "yyyy-MM-dd'T'HH:mm:ssZ");
    } else {
      return ''
    }
  }

  this.formatDate = function(value) {
    if(typeof(value) == 'string') {
      return Utilities.formatDate(new Date(value), 'GMT', 'yyyy-MM-dd');
    } else if(value) {
      return Utilities.formatDate(value, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    } else {
      return ''
    }
  }
}
var dataUtils = new DataUtils();

/**
 * Base class for all loaders, provides common functionality and top level
 * orchestration of common flows
 */
var BaseLoader = function(cmDAO) {
  // PRIVATE FIELDS

  // Provides access to private methods to the this instance
  var that = this;
  var references = [];
  var children = [];

  function whichTab(tabs) {
    tabs = Array.isArray(tabs) ? tabs : [tabs];
    var result = null;

    forEach(tabs, function(index, value) {
      if(!result && sheetDAO.tabExists(value)) {
        result = value;
      }
    });

    return result;
  }

  this.tabName = whichTab(this.tabName);

  /**
   * Maps child relationships defined in the children intenrnal field
   * by injecting a list of children in the feedItem.
   *
   * params:
   *  feedItem: The feed item to map
   */
  function mapChildRelationships(feedItem) {
    for(var i = 0; i < children.length; i++) {
      var childConfig = children[i];

      var childMap = {};

      var feedProvider = new FeedProvider(childConfig.tabName).load();

      var child = null;
      while(child = feedProvider.next()) {
        child[childConfig.relationshipField] = that.translateId(that.tabName, child, childConfig.relationshipField);

        var key = child[childConfig.relationshipField];

        if(!childMap[key]) {
          childMap[key] = [];
        }

        childMap[key].push(child);
      }

      var key = feedItem[childConfig.relationshipField];

      if(childMap[key]) {
        feedItem[childConfig.listName] = childMap[key];
      }
    }
  }

  /**
   * Pushes an item to an array if the item isn't present
   *
   * params:
   *  list: the array into which the item should be added
   *  item: value to be added to the array
   */
  this.pushUnique = function(list, item) {
    if (list.indexOf(item) === -1) {
      list.push(item);
    }
  }

  /**
   * Returns if a given value is true regardless if it is a boolean or a string
   * representation.
   *
   * params
   *  value: value to verify
   *
   * returns: true if the value represents true, or false otherwise
   */
  this.isTrue = function(value) {
    if(typeof(value) === 'string') {
      return value.toLowerCase() === 'true';
    } else {
      return value === true ;
    }
  }

  /**
   * Formats a date in the format CM requires
   *
   * params:
   *  feedItem: Bulkdozer feed item that contains the date
   *  fieldNam: the name of the date field
   *
   * returns: the formatted date value
   */
  this.formatDate = function(feedItem, fieldName) {
    var value = feedItem[fieldName];

    if(typeof(value) == 'string') {
      return Utilities.formatDate(new Date(value), 'GMT', 'yyyy-MM-dd');
    } else if(value) {
      return Utilities.formatDate(value, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    } else {
      return ''
    }
  }

  /**
   * Formats a date time in the format CM requires
   *
   * params:
   *  feedItem: Bulkdozer feed item that contains the date time
   *  fieldNam: the name of the date time field
   *
   * returns: the formatted date time value
   */
  this.formatDateTime = function(feedItem, fieldName) {
    var value = feedItem[fieldName];

    if(value && typeof(value) == 'string') {
      return value;
    } else if(value) {
      return Utilities.formatDate(value, SpreadsheetApp.getActive().getSpreadsheetTimeZone(),  "yyyy-MM-dd'T'HH:mm:ssZ");
    } else {
      return null;
    }
  }

  /**
   * Pre-fetches entities from CM using the list endpoint which can return
   * several items, these items are then cached and when the process invokes the
   * get() method the entity is returned from the cache dramatically reducing the
   * number of calls made to the CM API.
   *
   * params:
   *  entity: name of the entity to pre fetch
   *  listName: list name of the API return
   *  filterName: name of the filter to pass to the API call
   *  filterValues: list of values to be used to filter entities in conjunction
   *    of the filterName
   */
  this.preFetch = function(entity, listName, filterName, filterValues) {
    // The CM API throws a 400 if too many items are specified in the
    // filterValue, and therefore we use this chunk value to limit the number of
    // filters per call
    var chunk = 200;

    if(filterName && filterValues && filterValues.length > 0) {

      while(filterValues.length > 0) {
        var searchOptions = {};

        chunkFilterValues = filterValues.splice(0, chunk);

        if(chunkFilterValues.length > 0) {
          searchOptions[filterName] = chunkFilterValues;
          cmDAO.list(entity, listName, searchOptions);
        }
      }
    }
  }

  /**
   * Performs pre-fetch of entities that are related to this one based on feed
   * items, this causes entities to be cached reducing the number of API calls
   * to CM
   *
   * params:
   *  entity: name of the entity to pre fetch
   *  listName: list name of the API return
   *  filterName: name of the filter to pass to the API call
   *  feedItems: list of feed items the entity
   *  fieldName: name of the field in the feedItem to get values for the filter
   */
  this.preFetchFromFeed = function(entity, listName, filterName, feedProvider, fieldName) {
    if(filterName && feedProvider && !feedProvider.isEmpty()) {
      var filterValues = [];

      var feedItem = null;
      while(feedItem = feedProvider.next()) {
        if(feedItem[fieldName] && filterValues.indexOf(feedItem[fieldName]) == -1 && typeof(feedItem[fieldName]) == 'number') {
          filterValues.push(feedItem[fieldName]);
        }
      }

      this.preFetch(entity, listName, filterName, filterValues);
    }
  }

  /**
   * Performs pre-fetch of entities that are related to this one, this causes
   * other entities to be cached and reduce the number of API calls to CM
   *
   * params:
   *  entity: name of the entity to pre fetch
   *  listName: list name of the API return
   *  filterName: name of the filter to pass to the API call
   *  items: list of CM objects of the child entity
   *  fieldName: name of the field in the child entity from which to get values
   *  for the filter
   */
  this.preFetchFromObjs = function(entity, listName, filterName, items, fieldName) {
    if(filterName && items && items.length > 0) {
      var filterValues = [];

      for(var i = 0; i < items.length; i++) {
        var item = items[i];

        if(item[fieldName] && filterValues.indexOf(item[fieldName]) == -1) {
          filterValues.push(item[fieldName]);
        }
      }

      this.preFetch(entity, listName, filterName, filterValues);
    }
  }

  /**
   * Adds an item to the list of items only if it is unique. Uniquenes is
   * determined by item.id
   *
   * params:
   *  job: the current job object
   *  entity: the name of the entity being processed
   *  item: the item to add
   */
  this.add = function(job, entity, item) {
    if (!job[entity]) {
      job[entity] = [];
    }

    var items = job[entity];

    for (var i = 0; i < items.length; i++) {
      var current = items[i];
      if (current.id == item.id) {
        return;
      }
    }

    job[entity].push(item);
  };

  /**
   * Adds a log entry to the job logs
   *
   * params:
   *  job: the job object
   *  message: the log message to be added
   */
  this.log = function(job, message) {
    if(!job.logs) {
      job.logs = [];
    }

    job.logs.push([new Date(), message]);
  }

  /**
   * Based on the data in the feed, identify which items need to be loaded
   *
   * params:
   *  job: the job object
   */
  this.identifyItemsToLoad = function(job) {
    this.log(job, 'Identifying items to load: ' + this.label);

    var feedProvider = new FeedProvider(this.tabName, this.keys).load();

    var idsToLoad = [];
    job.idsToLoad = idsToLoad;
    idsToLoad[this.entity] = idsToLoad;

    var item = null;
    while(item = feedProvider.next()) {
      if(item[this.idField]) {
        var idString = new String(item[this.idField]).trim().toLowerCase();

        if(idString && idString != 'null' && idString.toLowerCase().indexOf('ext') != 0 && idString.length > 0) {
          this.pushUnique(idsToLoad, item[this.idField]);
        }
      }
    }
  }

  /**
   * Fetches items that need to be loaded from Campaign Manager based on the job
   * specification. This defers to the processSearchOptions method in child
   * classes to determine cascade items to load.
   *
   * This method can be overriden so child classes can fully control how to load
   * items from CM, e.g. EventTags have a different list function API signature
   * than other entities, and therefore needs to process the list with "gets"
   *
   * params:
   *  job: job specification
   *  job.idsToLoad: specific item ids to load
   *
   * returns: items loaded from Campaign Manager
   */
  this.fetchItemsToLoad = function(job) {
    var searchOptions = {};
    var hasItemsToLoad = false;

    if(job.idsToLoad && job.idsToLoad.length > 0) {
      searchOptions['ids'] = job.idsToLoad;
      hasItemsToLoad = true;
    }

    if(this.processSearchOptions) {
      if(this.processSearchOptions(job, searchOptions)) {
        hasItemsToLoad = true;
      }
    }

    this.log(job, 'Fetching ' + this.label + ' from campaign manager');

    var itemsToLoad = [];

    if(hasItemsToLoad) {
      itemsToLoad = cmDAO.list(that.entity, that.listField, searchOptions);
    }

    return itemsToLoad;
  }
  /**
   * Performs load from CM to the sheet. This method will read data from
   * Campaign Manager, transform it, and write to the respective tab in the
   * feed. What controls this execution are fields overriden by child classes.
   * This also calls "abstract" methods to delegate certain functionality such
   * as identifying cascade items to load to child classes.
   *
   * params:
   *  job: object representing the load task to execute
   *    job.idsToLoad: represent the item ids to load specified in the sheet by
   *    the user
   */
  this.load = function(job) {
    console.log('Loading ' + this.label);
    cmDAO.setCache(getCache('MEMORY'));

    var itemsToLoad = this.fetchItemsToLoad(job);

    if(itemsToLoad.length > 0 && job.preFetchConfigs && job.preFetchConfigs.length > 0) {
      for(var i = 0; i < job.preFetchConfigs.length; i++) {
        var preFetchConfig = job.preFetchConfigs[i];

        this.preFetchFromObjs(preFetchConfig.entity, preFetchConfig.listName, preFetchConfig.filterName, itemsToLoad, preFetchConfig.fieldName);
      }
    }

    // Map data from CM object to the feed
    this.log(job, 'Mapping ' + this.label + ' to the feed');

    var feed = [];
    var loadedIds = [];

    job.loadedIds = loadedIds;

    if(this.mapFeed) {
      for(var i = 0; i < itemsToLoad.length; i++) {
        var item = itemsToLoad[i];

        var mappedFeed = this.mapFeed(item);

        if(mappedFeed) {
          if(Array.isArray(mappedFeed)) {
            for(var j = 0; j < mappedFeed.length; j++) {
              feed.push(mappedFeed[j]);
            }
          } else {
            feed.push(mappedFeed);
          }
        }

        loadedIds.push(parseInt(item.id));
      }
    }

    // Clear feed and write loaded items to the feed
    var feedProvider = new FeedProvider(this.tabName, this.keys).setFeed(feed).save();
  }

  /**
   * Create one push job per item in the sheet.
   *
   * params:
   *  job: the job object
   *
   * returns: this method communicates back throuh the job object by parsing the
   * sheet of the tab of this instance into the job.jobs field
   */
  this.createPushJobs = function(job) {
    var feedProvider = new FeedProvider(this.tabName, this.keys).load();
    job.jobs = [];

    if(!feedProvider.isEmpty() && job.preFetchConfigs && job.preFetchConfigs.length > 0) {
      for(var i = 0; i < job.preFetchConfigs.length; i++) {
        var preFetchConfig = job.preFetchConfigs[i];

        this.preFetchFromFeed(preFetchConfig.entity, preFetchConfig.listName, preFetchConfig.filterName, feedProvider, preFetchConfig.fieldName);
      }
    }

    feedProvider.reset();
    var feedItem = null;
    while(feedItem = feedProvider.next(true)) {
      var pushJob = {
        'entity': job.entity,
        'feedItem': feedItem
      }

      job.jobs.push(pushJob);
    }
  }

  /**
   * Assigns a value from the feed to a field in the campaign manager object.
   * This handles checks to not update fields that are not required, which
   * defaults to keeping the value in CM
   *
   * params:
   *  cmObj: Campaign Manager object to update
   *  cmField: Field to update in the Campaign Manger Object
   *  feedItem: Dictionary representing an entry in the bulkdozer feed
   *  required: true if the field is required (will always update), false if not
   *  required, will keep value from CM
   *  defaultValue: value to default to in case of null
   */
  this.assign = function(cmObj, cmField, feedItem, feedField, required, defaultValue) {
    if(required) {
      cmObj[cmField] = feedItem[feedField] || defaultValue;
    } else {
      delete cmObj[cmField];

      if(feedItem[feedField] || defaultValue) {
        cmObj[cmField] = feedItem[feedField] || defaultValue;
      }
    }
  }

  /**
   * Adds a reference to the entity, indicating a given field in the feed maps
   * to another tab in the feed.
   *
   * params:
   *  tabName: The referenced tab
   *  field: the field in this entity's tab that references tabName
   */
  this.addReference = function(tabName, field) {
    var reference = {};

    reference.tabName = tabName;
    reference.field = field;

    references.push(reference);
  }

  /**
   * Adds a child relationship, which is automatically loaded into the feed as a
   * sub list identified by the name of the list name.
   *
   * params:
   *  tabName: Name of the feed tab that contains the child records
   *  listName: Name of the field to be used to hold the list of child feedItems
   *  in the parent feedItem
   *  childRelationshipField: Field in the child feedItem that points back to
   *  the parent (akin to a foreign key).
   */
  this.addChildRelationship = function(childTabName, childListName, childRelationshipField) {
    childTabName = whichTab(childTabName);

    children.push({
      'tabName': childTabName,
      'listName': childListName,
      'relationshipField': childRelationshipField
    });
  }

  /**
   * Translates the ext id to a concrete id of a given field in the feed
   *
   * params:
   *  tabName: Tab name referenced by the relationship
   *  feedItem: feed item
   *  fieldName: name of the field that is a reference to an item in tabName
   *
   * returns: the translated id
   */
  this.translateId = function(tabName, feedItem, fieldName) {
    var idValue = feedItem[fieldName];
    var translatedId = null;

    tabName = whichTab([tabName, 'QA']);

    if(String(idValue).indexOf('ext') == 0) {
      translatedId = getIdStore().translate(tabName, idValue);
    }

    return translatedId || idValue;
  }

  /**
   * Maps a feed to a CM object and updates CM
   *
   * params:
   *  job: the job object
   *  job.feedItem: feed item to map and push, it is updated with changes such
   *  as new ids
   */
  this.push = function(job) {
    if(job.feedItem.unkeyed) {
      this.log(job, this.idField + ' is empty for ' + this.label + '. Skipping');
      return;
    }

    cmDAO.setCache(getCache('SERVICE'));

    var idValue = job.feedItem[this.idField];

    try {
      getIdStore().initialize(job.idMap);

      var insert = true;

      this.log(job, 'Processing ' + this.label + ': ' + idValue);

      job.cmObject = {};

      if(idValue && !String(idValue).indexOf('ext') == 0) {
        job.cmObject = cmDAO.get(this.entity, idValue);
        insert = false;
      }

      mapChildRelationships(job.feedItem);

      for(var j = 0; j < references.length; j++) {
        var reference = references[j];

        job.feedItem[reference.field] = this.translateId(reference.tabName, job.feedItem, reference.field);
      }

      if(this.preProcessPush) {
        this.preProcessPush(job);
      }

      // Map feed to object
      this.processPush(job);

      job.cmObject = cmDAO.update(this.entity, job.cmObject);

      job.feedItem[this.idField] = job.cmObject.id;

      // Store new ids
      if(idValue && String(idValue).indexOf('ext') == 0) {
        getIdStore().addId(this.tabName, idValue, job.cmObject.id);
      }

      if(this.postProcessPush) {
        this.postProcessPush(job);
      }

    } catch(error) {
      this.log(job, 'Error processing ' + this.label + ': ' + idValue);
      this.log(job, 'Error Message: ' + error.message);

      throw error;
    }
  }

  /**
   * Updates the feed with new values from the job
   *
   * params:
   *  job.feed: list of dictionaries to flatten and update the feed
   *
   * returns: job
   */
  this.updateFeed = function(job) {
    new FeedProvider(this.tabName, this.keys).setFeed(job.feed).save();

    for(var i = 0; i < children.length; i++) {
      var childConfig = children[i];

      var childFeed = [];

      for(var j = 0; j < job.feed.length; j++) {
        feedItem = job.feed[j];

        if(feedItem[childConfig.listName]) {
          childFeed = childFeed.concat(feedItem[childConfig.listName]);
        }
      }

      new FeedProvider(childConfig.tabName).setFeed(childFeed).save();
    }

    return job;
  }
}

/**
 * Campaign Loader
 */
var CampaignLoader = function(cmDAO) {
  this.label = 'Campaign';
  this.entity = 'Campaigns';
  this.tabName = ['Campaign', 'QA'];
  this.idField = fields.campaignId;
  this.listField = 'campaigns';
  this.keys = ['Campaign ID'];

  BaseLoader.call(this, cmDAO);

  this.addReference('Landing Page', fields.landingPageId);

  /**
   * Turns a Campaign Manager Campaign object from the API into a feed item to
   * be written to the sheet
   *
   * params:
   *  campaign: Campaign object returned from the Campaign Manager API
   *
   * returns: a feed item representing the campaign to be written to the sheet
   */
  this.mapFeed = function(campaign) {
    var landingPage =
        cmDAO.get('AdvertiserLandingPages', campaign.defaultLandingPageId);

    var feedItem = {};
    feedItem[fields.campaignId] = campaign.id;
    feedItem[fields.campaignName] = campaign.name;
    feedItem[fields.advertiserId] = campaign.advertiserId;
    feedItem[fields.landingPageId] = campaign.defaultLandingPageId;
    feedItem[fields.landingPageName] = landingPage.name;
    feedItem[fields.campaignStartDate] = campaign.startDate;
    feedItem[fields.campaignEndDate] = campaign.endDate;

    return feedItem;
  };

  /**
   * This is called before an item is processed to allow an entity specific
   * loader to perform pre processing tasks, such as formatting dates,
   * validating fields, and changing data types.
   *
   * params:
   *  job: the push job
   */
  this.preProcessPush = function(job) {
    job.feedItem[fields.campaignStartDate] = this.formatDate(job.feedItem, fields.campaignStartDate);
    job.feedItem[fields.campaignEndDate] = this.formatDate(job.feedItem, fields.campaignEndDate);
  }

  /**
   * @see LandingPageLoader
   */
  this.processPush = function(job) {
    this.assign(job.cmObject, 'name', job.feedItem, fields.campaignName, true);
    this.assign(job.cmObject, 'advertiserId', job.feedItem, fields.advertiserId, true);
    this.assign(job.cmObject, 'defaultLandingPageId', job.feedItem, fields.landingPageId, true);
    this.assign(job.cmObject, 'startDate', job.feedItem, fields.campaignStartDate, true);
    this.assign(job.cmObject, 'endDate', job.feedItem, fields.campaignEndDate, true);
  }

  /**
   * This is called after an item is processed to allow an entity specific
   * loader to perform post processing tasks, such as updating informational
   * fields. This method changes the job properties directly.
   *
   * params:
   *  job: The job being post processed
   */
  this.postProcessPush = function(job) {
    var landingPage = cmDAO.get('AdvertiserLandingPages', job.cmObject.defaultLandingPageId);

    job.feedItem[fields.landingPageName] = landingPage.name;
  }
}
CampaignLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Landing Page Loader
 */
var LandingPageLoader = function(cmDAO) {
  this.label = 'Landing Page';
  this.entity = 'AdvertiserLandingPages';
  this.tabName = ['Landing Page', 'QA'];
  this.idField = fields.landingPageId;
  this.listField = 'landingPages';
  this.keys = ['Landing Page ID'];

  BaseLoader.call(this, cmDAO);

  /**
   * Processes search options to ensure all required items to load are fetched.
   * This method is optional and gives the sub classes of BaseLoader the
   * opportunity to identify additional items to load, such as cascade items
   *
   * params:
   *  job: The job with data about the load
   *  searchOptions: this method udpates search options directly, which is then
   *  passed into the CM api to fetch items to load
   *
   * returns:
   *  true if the process search options found new items to load, otherwise
   *  false
   *
   */
  this.processSearchOptions = function(job, searchOptions) {
    result = false;

    if(job.campaignIds && job.campaignIds.length > 0) {
      searchOptions['campaignIds'] = job.campaignIds;

      result = true;
    }

    return result;
  }

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(landingPage) {
    var feedItem = {};
    feedItem[fields.landingPageId] = landingPage.id;
    feedItem[fields.landingPageName] = landingPage.name;
    feedItem[fields.advertiserId] = landingPage.advertiserId;
    feedItem[fields.landingPageUrl] = landingPage.url;

    return feedItem;
  }

  /**
   * Maps feed item to campaign manager object
   *
   * params:
   *  job: the job object
   *  job.cmObject: cm object instance to update
   *  job.feedItem: dictionary representing the feed to read from
   */
  this.processPush = function(job) {
    this.assign(job.cmObject, 'name', job.feedItem, fields.landingPageName, true);
    this.assign(job.cmObject, 'url', job.feedItem, fields.landingPageUrl, true);
    this.assign(job.cmObject, 'advertiserId', job.feedItem, fields.advertiserId, true);
  }
}
LandingPageLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Event Tag Loader
 */
var EventTagLoader = function(cmDAO) {
  this.label = 'Event Tag';
  this.entity = 'EventTags';
  this.tabName = 'Event Tag';
  this.idField = fields.eventTagId;

  BaseLoader.call(this, cmDAO);

  this.addReference('Campaign', fields.campaignId);

  /**
   * @see BaseLoader.fetchItemsToLoad
   */
  this.fetchItemsToLoad = function(job) {
    var eventTagsMap = {};

    // Fetch all event tags identified by id
    if(job.idsToLoad && job.idsToLoad.length > 0) {
      for(var i = 0; i < job.idsToLoad.length; i++) {
        var eventTagId = job.idsToLoad[i];

        if(!eventTagsMap[eventTagId]) {
          eventTagsMap[eventTagId] = cmDAO.get('EventTags', eventTagId);
        }
      }
    }

    // Fetch all event tags associated with the campaigns
    if(job.campaignIds && job.campaignIds.length > 0) {
      for(var i = 0; i < job.campaignIds.length; i++) {
        var campaignId = job.campaignIds[i];

        var eventTags = cmDAO.list('EventTags', 'eventTags', {
          'campaignId': campaignId
        });

        for(var j = 0; j < eventTags.length; j++) {
          var eventTag = eventTags[j];

          if(!eventTagsMap[eventTag.id]) {
            eventTagsMap[eventTag.id] = eventTag;
          }
        }
      }
    }

    // Fetch all event tags associated with the ads
    // The API doesn't support fetching event tags in bulk like most of the
    // other entities, you can only fetch it by a single advertiser id, campaign
    // id, or ad id. To limit the number of API calls we identify the
    // advertisers ids for all ads and fetch at that level which is the highest,
    // then include only event tags that are being overriden by the ads.
    if(job.adIds && job.adIds.length > 0) {
      var ads = cmDAO.chunkFetch('Ads', 'ads', job.adIds);

      var advertiserIds = [];
      var eventTagIds = [];

      for(var i = 0; i < ads.length; i++) {
        var ad = ads[i];

        if(ad.eventTagOverrides && ad.eventTagOverrides.length > 0) {
          this.pushUnique(advertiserIds, ad.advertiserId);

          for(j = 0; j < ad.eventTagOverrides.length; j++) {
            var eventTagOverride = ad.eventTagOverrides[j];

            this.pushUnique(eventTagIds, eventTagOverride.id);
          }
        }
      }

      if(eventTagIds.length > 0 && advertiserIds.length > 0) {
        forEach(advertiserIds, function(index, advertiserId) {
          forEach(cmDAO.list('EventTags', 'eventTags',
                  { 'advertiserId': advertiserId }), function(index, eventTag) {
            if(eventTagIds.indexOf(eventTag.id) == -1) {
              eventTagsMap[eventTag.id] = eventTag;
            }
          });
        });
      }
    }

    var keys = Object.getOwnPropertyNames(eventTagsMap);
    var result = [];
    for(var i = 0; i < keys.length; i++) {
      result.push(eventTagsMap[keys[i]]);
    }

    return result;
  }

  /**
   * @see LandingPageLoader.processSearchOptions
   */
  this.processSearchOptions = function(job, searchOptions) {
    var result = false;

    if(job.adIds && job.adIds.length > 0) {
      searchOptions.adId = job.adIds;

      result = true;
    }

    if(job.campaignIds && job.campaignIds.length > 0) {
      searchOptions.campaignId = job.campaignIds;

      result = true;
    }

    return result;
  }

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(eventTag) {
    var campaign = cmDAO.get('Campaigns', eventTag.campaignId);

    var feedItem = {};
    feedItem[fields.advertiserId] = eventTag.advertiserId;

    if (campaign) {
      feedItem[fields.campaignId] = campaign.id;
      feedItem[fields.campaignName] = campaign.name;
    }

    feedItem[fields.eventTagId] = eventTag.id;
    feedItem[fields.eventTagName] = eventTag.name;
    feedItem[fields.eventTagStatus] = eventTag.status;
    feedItem[fields.enableByDefault] = eventTag.enabledByDefault;
    feedItem[fields.eventTagType] = eventTag.type;
    feedItem[fields.eventTagUrl] = eventTag.url;

    return feedItem;
  }

  /**
   * @see LandingPageLoader.processPush
   */
  this.processPush = function(job) {
    this.assign(job.cmObject, 'advertiserId', job.feedItem, fields.advertiserId, true);
    this.assign(job.cmObject, 'campaignId', job.feedItem, fields.campaignId, false);

    this.assign(job.cmObject, 'name', job.feedItem, fields.eventTagName, true);
    this.assign(job.cmObject, 'type', job.feedItem, fields.eventTagType, true);
    this.assign(job.cmObject, 'url', job.feedItem, fields.eventTagUrl, true);
    this.assign(job.cmObject, 'status', job.feedItem, fields.eventTagStatus, true);

    job.cmObject.enabledByDefault = this.isTrue(job.feedItem[fields.enableByDefault]);
  }

  /**
   * @see CampaignLoader.postProcessPush
   */
  this.postProcessPush = function(job) {
    if(job.cmObject.campaignId) {
      var campaign = cmDAO.get('Campaigns', job.cmObject.campaignId);

      job.feedItem[fields.campaignName] = campaign.name;
    }
  }
}
EventTagLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Placement Group Loader
 */
var PlacementGroupLoader = function(cmDAO) {
  this.label = 'Placement Group';
  this.entity = 'PlacementGroups';
  this.tabName = ['Placement Group', 'QA'];
  this.idField = fields.placementGroupId;
  this.listField = 'placementGroups';
  this.keys = ['Placement Group ID'];

  BaseLoader.call(this, cmDAO);

  this.addReference('Campaign', fields.campaignId);

  /**
   * @see LandingPageLoader.processSearchOptions
   */
  this.processSearchOptions = function(job, searchOptions) {
    var result = false;

    if(job.campaignIds && job.campaignIds.length > 0) {
      searchOptions['campaignIds'] = job.campaignIds;

      result = true;
    }

    return result;
  }

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(placementGroup) {
    var feedItem = {};
    var site = cmDAO.get('Sites', placementGroup.siteId);
    var campaign = cmDAO.get('Campaigns', placementGroup.campaignId);

    feedItem[fields.advertiserId] = placementGroup.advertiserId;
    feedItem[fields.campaignId] = placementGroup.campaignId;
    feedItem[fields.campaignName] = campaign.name;
    feedItem[fields.siteId] = placementGroup.siteId;
    feedItem[fields.siteName] = site.name;
    feedItem[fields.placementGroupId] = placementGroup.id;
    feedItem[fields.placementGroupName] = placementGroup.name;
    feedItem[fields.placementGroupType] = placementGroup.placementGroupType;
    feedItem[fields.placementGroupStartDate] = placementGroup.pricingSchedule.startDate;
    feedItem[fields.placementGroupEndDate] = placementGroup.pricingSchedule.endDate;
    feedItem[fields.placementGroupPricingType] = placementGroup.pricingSchedule.pricingType;

    return feedItem;
  }

  /**
   * @see CampaignLoader.preProcessPush
   */
  this.preProcessPush = function(job) {
    job.feedItem[fields.placementGroupStartDate] = this.formatDate(job.feedItem, fields.placementGroupStartDate);
    job.feedItem[fields.placementGroupEndDate] = this.formatDate(job.feedItem, fields.placementGroupEndDate);
  }

  /**
   * @see LandingPageLoader.processPush
   */
  this.processPush = function(job) {
    this.assign(job.cmObject, 'advertiserId', job.feedItem, fields.advertiserId, true);
    this.assign(job.cmObject, 'campaignId', job.feedItem, fields.campaignId, true);
    this.assign(job.cmObject, 'siteId', job.feedItem, fields.siteId, true);
    this.assign(job.cmObject, 'name', job.feedItem, fields.placementGroupName, true);
    this.assign(job.cmObject, 'placementGroupType', job.feedItem, fields.placementGroupType, true);

    if(!job.cmObject.pricingSchedule) {
      job.cmObject.pricingSchedule = {};
    }
    this.assign(job.cmObject.pricingSchedule, 'startDate', job.feedItem, fields.placementGroupStartDate, true);
    this.assign(job.cmObject.pricingSchedule, 'endDate', job.feedItem, fields.placementGroupEndDate, true);
    this.assign(job.cmObject.pricingSchedule, 'pricingType', job.feedItem, fields.placementGroupPricingType, true);
  }

  /**
   * @see CampaignLoader.postProcessPush
   */
  this.postProcessPush = function(job) {
    var campaign = cmDAO.get('Campaigns', job.feedItem[fields.campaignId]);
    var site = cmDAO.get('Sites', job.feedItem[fields.siteId]);

    job.feedItem[fields.campaignName] = campaign.name;
    job.feedItem[fields.siteName] = site.name;
  }
}
PlacementGroupLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Placement Loader
 */
var PlacementLoader = function(cmDAO) {
  var that = this;
  this.label = 'Placement';
  this.entity = 'Placements';
  this.tabName = ['Placement', 'QA'];
  this.idField = fields.placementId;
  this.listField = 'placements';
  this.keys = ['Placement ID'];

  BaseLoader.call(this, cmDAO);

  this.addChildRelationship('Placement Pricing Schedule', 'pricingSchedule', fields.placementId);

  this.addReference('Campaign', fields.campaignId);
  this.addReference('Placement Group', fields.placementGroupId);

  /**
   * @see LandingPageLoader.processSearchOptions
   */
  this.processSearchOptions = function(job, searchOptions) {
    var result = false;

    if(job.campaignIds && job.campaignIds.length > 0) {
      searchOptions['campaignIds'] = job.campaignIds;

      result = true;
    }

    if(job.placementGroupIds && job.placementGroupIds.length > 0) {
      searchOptions['groupIds'] = job.placementGroupIds;

      result = true;
    }

    return result;
  }

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(placement) {
    var campaign = cmDAO.get('Campaigns', placement.campaignId);
    var site = cmDAO.get('Sites', placement.siteId);
    var placementGroup = null;

    if(placement.placementGroupId) {
      placementGroup = cmDAO.get('PlacementGroups', placement.placementGroupId);
    }

    var feedItem = {};
    feedItem[fields.placementId] = placement.id;
    feedItem[fields.placementName] = placement.name;
    feedItem[fields.archived] = placement.archived;

    if (placement.vpaidAdapterChoice == 'HTML5' &&
        !placement.videoActiveViewOptOut) {
      feedItem[fields.activeView] = 'ON'
    } else if (
        placement.vpaidAdapterChoice == 'DEFAULT' &&
        placement.videoActiveViewOptOut) {
      feedItem[fields.activeView] = 'OFF'
    } else {
      feedItem[fields.activeView] = 'LET_DCM_DECIDE'
    }

    feedItem[fields.adBlocking] = placement.adBlockingOptOut;
    feedItem[fields.siteId] = site.id;
    feedItem[fields.siteName] = site.name;

    feedItem[fields.campaignName] = campaign.name;
    feedItem[fields.campaignId] = campaign.id;
    feedItem[fields.placementStartDate] = placement.pricingSchedule.startDate;
    feedItem[fields.placementEndDate] = placement.pricingSchedule.endDate;
    feedItem[fields.placementPricingScheduleCostStructure] = placement.pricingSchedule.pricingType;
    feedItem[fields.pricingScheduleTestingStart] = placement.pricingSchedule.testingStartDate;

    if(placement.tagSetting) {
      feedItem[fields.placementAdditionalKeyValues] = placement.tagSetting.additionalKeyValues;
    }

    if(placement.videoSettings && placement.videoSettings.skippableSettings) {
      var skippableSettings = placement.videoSettings.skippableSettings;

      feedItem[fields.placementSkippable] = skippableSettings.skippable;
      feedItem[fields.placementSkipOffsetSeconds] = skippableSettings.skipOffset.offsetSeconds;
      feedItem[fields.placementSkipOffsetPercentage] = skippableSettings.skipOffset.offsetPercentage;
      feedItem[fields.placementProgressOffsetSeconds] = skippableSettings.progressOffset.offsetSeconds;
      feedItem[fields.placementProgressOffsetPercentage] = skippableSettings.progressOffset.offsetPercentage;
    }

    if(placementGroup) {
      feedItem[fields.placementGroupId] = placementGroup.id;
      feedItem[fields.placementGroupName] = placementGroup.name;
    }

    if(placement.size) {
      var sizes = [String(placement.size.width) + 'x' + String(placement.size.height)];

      if(placement.additionalSizes) {
        for(var i = 0; i < placement.additionalSizes.length; i++) {
          var additionalSize = placement.additionalSizes[i];

          sizes.push(String(additionalSize.width) + 'x' + String(additionalSize.height));
        }
      }

      feedItem[fields.placementAssetSize] = sizes.join(', ');
    }

    // Handle landing pages

    feedItem[fields.placementType] = placement.compatibility;

    return feedItem;
  }

  /**
   * @see CampaignLoader.preProcessPush
   */
  this.preProcessPush = function(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;

    feedItem[fields.placementStartDate] = this.formatDate(feedItem, fields.placementStartDate);
    feedItem[fields.placementEndDate] = this.formatDate(feedItem, fields.placementEndDate);
  }

  /**
   * Logic to update active view and verification related fields
   *
   * params:
   *  job: the current job
   */
  function processActiveViewAndVerification(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;
    var activeView = feedItem[fields.activeView] || '';

    if(activeView === 'ON') {
      placement['vpaidAdapterChoice'] = 'HTML5';
      placement['videoActiveViewOptOut'] = false;
    } else if (activeView === 'OFF') {
      placement['vpaidAdapterChoice'] = 'DEFAULT';
      placement['videoActiveViewOptOut'] = true;
    } else if (activeView === 'LET_DCM_DECIDE' || activeView === '') {
      placement['vpaidAdapterChoice'] = 'DEFAULT';
      placement['videoActiveViewOptOut'] = false;
    } else {
      throw activeView + ' is not a valid value for the placement Active View and Verification field';
    }
  }

  /**
   * Logic to process the child feed for pricing schedule
   *
   * params:
   *  job: the current job
   */
  function processPricingSchedule(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;

    if(!placement.pricingSchedule) {
      placement.pricingSchedule = {};
    }

    placement.pricingSchedule.startDate = that.formatDate(feedItem, fields.placementStartDate);
    placement.pricingSchedule.endDate = that.formatDate(feedItem, fields.placementEndDate);

    that.assign(placement.pricingSchedule, 'pricingType', feedItem, fields.placementPricingScheduleCostStructure, false, 'PRICING_TYPE_CPM');

    if(!feedItem.pricingSchedule && !placement.pricingSchedule.pricingPeriods) {
      var pricingPeriod = {};

      pricingPeriod['startDate'] = that.formatDate(feedItem, fields.placementStartDate);
      pricingPeriod['endDate'] = that.formatDate(feedItem, fields.placementEndDate);

      placement.pricingSchedule.pricingPeriods = [pricingPeriod];
    } else if(feedItem.pricingSchedule) {
      placement.pricingSchedule.pricingPeriods = [];

      for(var i = 0; i < feedItem.pricingSchedule.length; i++) {
        var pricingFeedItem = feedItem.pricingSchedule[i];

        var pricingPeriod = {
          'endDate': that.formatDate(pricingFeedItem, fields.pricingPeriodEnd),
          'startDate': that.formatDate(pricingFeedItem, fields.pricingPeriodStart),
          'rateOrCostNanos': Math.floor(pricingFeedItem[fields.pricingPeriodRate] * 1000000000),
          'units': pricingFeedItem[fields.pricingPeriodUnits]
        }

        placement.pricingSchedule.pricingPeriods.push(pricingPeriod);
      }
    }
  }

  /**
   * Logic to post process the child feed for pricing schedule
   *
   * params:
   *  job: the current job
   */
  function pricingSchedulePostProcess(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;

    if(placement.pricingSchedule && placement.pricingSchedule.pricingPeriods) {
      var pricingPeriods = placement.pricingSchedule.pricingPeriods;

      feedItem.pricingSchedule = [];

      for(var i = 0; i < pricingPeriods.length; i++) {
        var pricingPeriod = pricingPeriods[i];
        var periodFeedItem = {};

        periodFeedItem[fields.pricingPeriodEnd] = pricingPeriod.endDate;
        periodFeedItem[fields.pricingPeriodStart] = pricingPeriod.startDate;
        periodFeedItem[fields.pricingPeriodRate] = pricingPeriod.rateOrCostNanos / 1000000000;
        periodFeedItem[fields.pricingPeriodUnits] = pricingPeriod.units;
        periodFeedItem[fields.placementName] = placement.name;
        periodFeedItem[fields.placementId] = placement.id;

        feedItem.pricingSchedule.push(periodFeedItem);
      }
    }
  }

  /**
   * Logic to process skippability
   *
   * params:
   *  job: the current job
   */
  function processSkippability(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;

    if(that.isTrue(feedItem[fields.placementSkippable])) {
      if(!placement.videoSettings) {
        placement.videoSettings = {}
      }

      var skippableSettings = {
        'skippable': that.isTrue(feedItem[fields.placementSkippable]),
        'skipOffset': {},
        'progressOffset': {}
      }

      placement.videoSettings.skippableSettings = skippableSettings;

      that.assign(skippableSettings.skipOffset, 'offsetSeconds', feedItem, fields.placementSkipOffsetSeconds, false);
      that.assign(skippableSettings.skipOffset, 'offsetPercentage', feedItem, fields.placementSkipOffsetPercentage, false);
      that.assign(skippableSettings.progressOffset, 'offsetSeconds', feedItem, fields.placementProgressOffsetSeconds, false);
      that.assign(skippableSettings.progressOffset, 'offsetPercentage', feedItem, fields.placementProgressOffsetPercentage, false);
    } else if(placement.videoSettings){
      delete placement.videoSettings.skippableSettings;
    }
  }

  /**
   * Logic to process placement size and additional sizes based on comma
   * separated values list from the feed
   *
   * params:
   *  placement: CM placement object
   *  sizeText: Comma separated list of width + 'x' + height.
   *    e.g.: 300x600, 800x160
   */
  function processSizes(placement, sizeText) {
    var rawSizes = sizeText.split(',');
    var placementSizes = [];

    for(var i = 0; i < rawSizes.length; i++) {
      var rawSize = rawSizes[i];

      var width = 1;
      var height = 1;

      if(rawSize && rawSize.toLowerCase().indexOf('x') != -1) {
        var splitSize = rawSize.toLowerCase().trim().split('x');
        width = parseInt(splitSize[0]);
        height = parseInt(splitSize[1]);
      }

      var sizes = cmDAO.getSize(width, height);
      var found = false;

      for(var j = 0; j < sizes.length && !found; j++) {
        var size = sizes[j];
        if(height === size['height'] && width === size['width']) {
          placementSizes.push({'id': size.id});
          found = true;
        }
      }

      if(!found) {
        placementSizes.push({'width': width, 'height': height});
      }
    }

    placement['size'] = null;
    placement['additionalSizes'] = [];

    for(var j = 0; j < placementSizes.length; j++) {
      var size = placementSizes[j];
      if(j == 0) {
        placement['size'] = size;
      } else {
        placement['additionalSizes'].push(size);
      }
    }
  }

  /**
   * Logic to process compatibility
   *
   * params:
   *  job: the current job
   */
  function processCompatibility(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;

    var type = feedItem[fields.placementType];

    if(type === 'VIDEO' || type == 'IN_STREAM_VIDEO') {
      placement['compatibility'] = 'IN_STREAM_VIDEO';
      placement['size'] = {'width': '0', 'height': '0'};
      placement['tagFormats'] = ['PLACEMENT_TAG_INSTREAM_VIDEO_PREFETCH'];
    } else {
      placement['compatibility'] = 'DISPLAY';

      processSizes(placement, feedItem[fields.placementAssetSize]);

      placement['tagFormats'] = [
          'PLACEMENT_TAG_STANDARD', 'PLACEMENT_TAG_JAVASCRIPT',
          'PLACEMENT_TAG_IFRAME_JAVASCRIPT', 'PLACEMENT_TAG_IFRAME_ILAYER',
          'PLACEMENT_TAG_INTERNAL_REDIRECT', 'PLACEMENT_TAG_TRACKING',
          'PLACEMENT_TAG_TRACKING_IFRAME', 'PLACEMENT_TAG_TRACKING_JAVASCRIPT'
      ]
    }
  }

  /**
   * @see LandingPageLoader.processPush
   */
  this.processPush = function(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;

    // Handle base fields
    this.assign(placement, 'name', feedItem, fields.placementName, true);
    this.assign(placement, 'archived', feedItem, this.isTrue(fields.archived));
    this.assign(placement, 'adBlockingOptOut', feedItem, this.isTrue(fields.adBlocking));
    this.assign(placement, 'siteId', feedItem, fields.siteId, true);
    this.assign(placement, 'placementGroupId', feedItem, fields.placementGroupId, false);
    this.assign(placement, 'campaignId', feedItem, fields.campaignId, true);

    if(!placement.tagSetting) {
      placement.tagSetting = {};
    }
    this.assign(placement.tagSetting, 'additionalKeyValues', feedItem, fields.placementAdditionalKeyValues, false);

    placement.paymentSource = 'PLACEMENT_AGENCY_PAID';

    processActiveViewAndVerification(job);
    processPricingSchedule(job);
    processCompatibility(job);
    processSkippability(job);
  }

  /**
   * @see LandingPageLoader.postProcessPush
   */
  this.postProcessPush = function(job) {
    var feedItem = job.feedItem;
    var placement = job.cmObject;
    var site = cmDAO.get('Sites', feedItem[fields.siteId]);
    var campaign = cmDAO.get('Campaigns', feedItem[fields.campaignId]);

    if(feedItem[fields.placementGroupId]) {
      var placementGroup = cmDAO.get('PlacementGroups', feedItem[fields.placementGroupId]);
      feedItem[fields.placementGroupName] = placementGroup.name;
    }

    feedItem[fields.siteName] = site.name;
    feedItem[fields.campaignName] = campaign.name;

    pricingSchedulePostProcess(job);
  }
}
PlacementLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Creative Loader
 */
var CreativeLoader = function(cmDAO) {
  this.label = 'Creative';
  this.entity = 'Creatives';
  this.tabName = ['Creative', 'QA'];
  this.idField = fields.creativeId;
  this.listField = 'creatives';
  this.keys = ['Creative ID'];

  BaseLoader.call(this, cmDAO);

  this.addReference('Campaign', fields.campaignId);

  /**
   * @see BaseLoader.fetchItemsToLoad
   */
  this.fetchItemsToLoad = function(job) {
    var creativesMap = {};

    if(job.idsToLoad && job.idsToLoad.length > 0) {
      for(var i = 0; i < job.idsToLoad.length; i++) {
        var creativeId = job.idsToLoad[i];

        if(!creativesMap[creativeId]) {
          creativesMap[creativeId] = cmDAO.get('Creatives', creativeId);
        }
      }
    }

    if(job.campaignIds && job.campaignIds.length > 0) {
      for(var i = 0; i < job.campaignIds.length; i++) {
        var campaignId = job.campaignIds[i];

        var campaign = cmDAO.get('Campaigns', campaignId);

        var creatives = cmDAO.list('Creatives', 'creatives', {
          'campaignId': campaignId
        });

        for(var j = 0; j < creatives.length; j++) {
          var creative = creatives[j];

          creative.campaignId = campaignId;

          if(!creativesMap[creative.id]) {
            creativesMap[creative.id] = creative;
          }
        }
      }
    }

    var keys = Object.getOwnPropertyNames(creativesMap);
    var result = [];
    for(var i = 0; i < keys.length; i++) {
      result.push(creativesMap[keys[i]]);
    }

    return result;
  }

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(creative) {
    var campaign = cmDAO.get('Campaigns', creative.campaignId);

    var feedItem = {};

    if (campaign) {
      feedItem[fields.advertiserId] = campaign.advertiserId;
      feedItem[fields.campaignId] = campaign.id;
      feedItem[fields.campaignName] = campaign.name;
    }

    feedItem[fields.creativeId] = creative.id;
    feedItem[fields.creativeName] = creative.name;
    feedItem[fields.creativeType] =
        creative.type == 'INSTREAM_VIDEO' ? 'VIDEO' : 'DISPLAY';
    feedItem[fields.advertiserId] = creative.advertiserId;

    return feedItem;
  }

  /**
   * @see LandingPageLoader.processPush
   */
  this.processPush = function(job) {
    var creative = job.cmObject;
    var feedItem = job.feedItem;

    if(feedItem[fields.creativeName]) {
      creative.name = feedItem[fields.creativeName];
    }
  }

  /**
   * @see CampaignLoader.postProcessPush
   */
  this.postProcessPush = function(job) {
    var campaign = cmDAO.get('Campaigns', job.feedItem[fields.campaignId]);

    cmDAO.associateCreativeToCampaign(campaign.id, job.cmObject.id);

    job.feedItem[fields.campaignName] = campaign.name;
  }
}
CreativeLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Ad Loader
 */
var AdLoader = function(cmDAO) {
  that = this;
  this.label = 'Ad';
  this.entity = 'Ads';
  this.tabName = ['Ad', 'QA'];
  this.idField = fields.adId;
  this.listField = 'ads';
  this.keys = ['Ad ID'];

  BaseLoader.call(this, cmDAO);

  this.addReference('Campaign', fields.campaignId);
  this.addChildRelationship(['Ad Placement Assignment', 'QA'], 'placementAssignments', fields.adId);
  this.addChildRelationship(['Ad Creative Assignment', 'QA'], 'creativeAssignments', fields.adId);
  this.addChildRelationship('Event Tag Ad Assignment', 'eventTagAssignments', fields.adId);

  /**
   * @see LandingPageLoader.processSearchOptions
   */
  this.processSearchOptions = function(job, searchOptions) {
    var result = false;

    if(job.campaignIds && job.campaignIds.length > 0) {
      searchOptions['campaignIds'] = job.campaignIds;

      result = true;
    }

    if(job.placementIds && job.placementIds.length > 0) {
      searchOptions['placementIds'] = job.placementIds;

      result = true;
    }

    if(getActiveOnlyFlag()) {
      searchOptions['active'] = true;
    }

    return result;
  }

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(ad) {
    var campaign = cmDAO.get('Campaigns', ad.campaignId);

    var feedItem = {};

    feedItem[fields.campaignId] = campaign.id;
    feedItem[fields.campaignName] = campaign.name;

    feedItem[fields.adActive] = ad.active;

    var creativeRotation = ad.creativeRotation;

    feedItem[fields.creativeRotation] = dataUtils.creativeRotationType(ad.creativeRotation);

    feedItem[fields.adArchived] = ad.archived;
    feedItem[fields.adPriority] =
        ad.deliverySchedule ? ad.deliverySchedule.priority : null;

    feedItem[fields.adId] = ad.id;
    feedItem[fields.adName] = ad.name;

    feedItem[fields.adStartDate] = Utilities.formatDate(new Date(ad.startTime), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ");
    feedItem[fields.adEndDate] = Utilities.formatDate(new Date(ad.endTime), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ");
    feedItem[fields.adType] = ad.type;

    if (ad.deliverySchedule) {
      feedItem[fields.hardCutoff] = ad.deliverySchedule.hardCutoff;
    }

    return feedItem;
  }

  /**
   * Logic to process child feed for creative assignments
   *
   * params:
   *  job: the current job
   */
  function processCreativeAssignments(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    if(feedItem.creativeAssignments) {
      var creativeAssignments = [];

      for(var i = 0; i < feedItem.creativeAssignments.length; i++) {
        var assignmentFeed = feedItem.creativeAssignments[i];

        if(assignmentFeed[fields.creativeId]) {

          assignmentFeed[fields.adCreativeAssignmentStartDate] = that.formatDateTime(assignmentFeed, fields.adCreativeAssignmentStartDate);
          assignmentFeed[fields.adCreativeAssignmentEndDate] = that.formatDateTime(assignmentFeed, fields.adCreativeAssignmentEndDate);

          var assignment = {
            'active': true,
            'creativeId': assignmentFeed[fields.creativeId],
            'startTime': assignmentFeed[fields.adCreativeAssignmentStartDate],
            'endTime': assignmentFeed[fields.adCreativeAssignmentEndDate]
          }

          if(assignmentFeed[fields.creativeRotationWeight]) {
            assignment.weight = assignmentFeed[fields.creativeRotationWeight];
          }

          if(assignmentFeed[fields.creativeRotationSequence]) {
            assignment.sequence = assignmentFeed[fields.creativeRotationSequence];
          }

          assignment.clickThroughUrl = {};
          if(!assignmentFeed[fields.landingPageId] && !assignmentFeed[fields.customClickThroughUrl]) {
            assignment.clickThroughUrl.defaultLandingPage = true;
          } else if(assignmentFeed[fields.landingPageId]) {
            assignmentFeed[fields.landingPageId] = that.translateId('Landing Page', assignmentFeed, fields.landingPageId);
            assignment.clickThroughUrl.defaultLandingPage = false;
            assignment.clickThroughUrl.landingPageId = assignmentFeed[fields.landingPageId];
          } else if(assignmentFeed[fields.customClickThroughUrl]) {
            assignment.clickThroughUrl.defaultLandingPage = false;
            assignment.clickThroughUrl.customClickThroughUrl = assignmentFeed[fields.customClickThroughUrl];
          }

          creativeAssignments.push(assignment);
        }
      }

      ad.creativeRotation.creativeAssignments = creativeAssignments;
    }
  }

  function processPlacementAssignment(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    if(feedItem.placementAssignments) {
      var placementAssignments = [];

      for(var i = 0; i < feedItem.placementAssignments.length; i++) {
        var placementAssignment = feedItem.placementAssignments[i];

        if(placementAssignment[fields.placementId]) {

          var placement = cmDAO.get('Placements', that.translateId('Placement', placementAssignment, fields.placementId));

          placementAssignment[fields.placementId] = placement.id;

          placementAssignments.push({
            'active': true,
            'placementId': placement.id
          });
        }
      }

      ad.placementAssignments = placementAssignments;
    }
  }

  /**
   * Logic to process rotation
   *
   * params:
   *  job: the current job
   */
  function processRotationStrategy(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    var option = (feedItem[fields.creativeRotation] || 'EVEN').toUpperCase();
    var creativeRotation = {};

    if(option == 'EVEN') {
        creativeRotation['type'] = 'CREATIVE_ROTATION_TYPE_RANDOM';
        creativeRotation['weightCalculationStrategy'] = 'WEIGHT_STRATEGY_EQUAL';
    } else if(option == 'SEQUENTIAL') {
        creativeRotation['type'] = 'CREATIVE_ROTATION_TYPE_SEQUENTIAL';
        creativeRotation['weightCalculationStrategy'] = null;
    } else if(option == 'CUSTOM') {
        creativeRotation['type'] = 'CREATIVE_ROTATION_TYPE_RANDOM';
        creativeRotation['weightCalculationStrategy'] = 'WEIGHT_STRATEGY_CUSTOM';
    } else if(option == 'CLICK-THROUGH RATE') {
        creativeRotation['type'] = 'CREATIVE_ROTATION_TYPE_RANDOM';
        creativeRotation['weightCalculationStrategy'] = 'WEIGHT_STRATEGY_HIGHEST_CTR';
    } else if(option == 'OPTIMIZED') {
        creativeRotation['type'] = 'CREATIVE_ROTATION_TYPE_RANDOM';
        creativeRotation['weightCalculationStrategy'] = 'WEIGHT_STRATEGY_OPTIMIZED';
    }

    ad.creativeRotation = creativeRotation;
  }

  /**
   * Logic to process event tag assignment
   *
   * params:
   *  job: the current job
   */
  function processEventTagAssignment(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    var eventTagAssignments = [];

    if(feedItem.eventTagAssignments) {
      for(var i = 0; i < feedItem.eventTagAssignments.length; i++) {
        var eventTagAssignment = feedItem.eventTagAssignments[i];

        var eventTag = cmDAO.get('EventTags', that.translateId('Event Tag', eventTagAssignment, fields.eventTagId));

        eventTagAssignment[fields.eventTagId] = eventTag.id;

        eventTagAssignments.push({
          'enabled': that.isTrue(eventTagAssignment[fields.enabled]),
          'id': eventTag.id
        });
      }
    }

    ad.eventTagOverrides = eventTagAssignments;
  }

  /**
   * @see Campaign.preProcessPush
   */
  this.preProcessPush = function(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    feedItem[fields.adStartDate] = this.formatDateTime(feedItem, fields.adStartDate);
    feedItem[fields.adEndDate] = this.formatDateTime(feedItem, fields.adEndDate);
  }

  /**
   * @see LandingPageLoader.processPush
   */
  this.processPush = function(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    // Handle base fields
    if(feedItem.hasOwnProperty(fields.adActive)) {
      ad.active = this.isTrue(feedItem[fields.adActive]);
    }
    ad.campaignId = feedItem[fields.campaignId];
    ad.archived = this.isTrue(feedItem[fields.adArchived]);
    ad.startTime = feedItem[fields.adStartDate];
    ad.endTime = feedItem[fields.adEndDate];
    ad.name = feedItem[fields.adName];
    ad.type = feedItem[fields.adType];

    if(ad.type != 'AD_SERVING_DEFAULT_AD') {
      if(!ad.deliverySchedule) {
        ad.deliverySchedule = {};
        ad.deliverySchedule.impressionRatio = 1;
      }
      ad.deliverySchedule.priority = feedItem[fields.adPriority];

      if(feedItem.hasOwnProperty(fields.hardCutoff) && feedItem[fields.hardCutoff] !== '') {
        ad.deliverySchedule.hardCutoff = this.isTrue(feedItem[fields.hardCutoff]);
      }
    }

    // Handle creative assignment
    processRotationStrategy(job);
    processCreativeAssignments(job);

    // Handle placement assignment
    processPlacementAssignment(job);

    // Handle event tag assignment
    processEventTagAssignment(job);

    // Handle landing pages
  }

  /**
   * @see CampaignLoader.postProcessPush
   */
  this.postProcessPush = function(job) {
    var feedItem = job.feedItem;
    var ad = job.cmObject;

    var campaign = cmDAO.get('Campaigns', ad.campaignId);

    feedItem[fields.campaignName] = campaign.name;

    if(feedItem.creativeAssignments) {
      for(var i = 0; i < feedItem.creativeAssignments.length; i++) {
        var creativeAssignment = feedItem.creativeAssignments[i];
        var creative = cmDAO.get('Creatives', creativeAssignment[fields.creativeId]);

        creativeAssignment[fields.adName] = ad.name;
        creativeAssignment[fields.adId] = ad.id;
        creativeAssignment[fields.creativeName] = creative.name;

        if(creativeAssignment[fields.landingPageId]) {
          var landingPage = cmDAO.get('AdvertiserLandingPages', creativeAssignment[fields.landingPageId]);

          creativeAssignment[fields.landingPageName] = landingPage.name;
        }
      }
    }

    if(feedItem.placementAssignments) {
      for(var i = 0; i < feedItem.placementAssignments.length; i++) {
        var placementAssignment = feedItem.placementAssignments[i];
        var placement = cmDAO.get('Placements', placementAssignment[fields.placementId]);

        placementAssignment[fields.placementName] = placement.name;
        placementAssignment[fields.placementId] = placement.id;
        placementAssignment[fields.adId] = that.translateId('Ad', placementAssignment, fields.adId);
        placementAssignment[fields.adName] = feedItem[fields.adName];
      }
    }

    if(feedItem.eventTagAssignments) {
      for(var i = 0; i < feedItem.eventTagAssignments.length; i++) {
        var eventTagAssignment = feedItem.eventTagAssignments[i];
        var eventTag = cmDAO.get('EventTags', eventTagAssignment[fields.eventTagId]);

        eventTagAssignment[fields.eventTagId] = eventTag.id;
        eventTagAssignment[fields.eventTagName] = eventTag.name;
        eventTagAssignment[fields.adId] = ad.id;
        eventTagAssignment[fields.adName] = ad.name;
      }
    }
  }
}
AdLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Ad Placement Loader
 */
var AdPlacementLoader = function(cmDAO) {
  this.label = 'Ad Placement Assignment';
  this.entity = 'Ads';
  this.tabName = ['Ad Placement Assignment', 'QA'];
  this.idField = fields.adId;
  this.listField = 'ads';
  this.keys = ['Ad ID', 'Placement ID'];

  BaseLoader.call(this, cmDAO);

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(ad) {
    if(ad.placementAssignments) {
      var feedItems = [], currentItem, currentPlacement;

      for (var i = 0; i < ad.placementAssignments.length; i++) {
        currentItem = {};

        currentPlacement =
            cmDAO.get('Placements', ad.placementAssignments[i].placementId);

        currentItem[fields.adId] = ad.id;
        currentItem[fields.adName] = ad.name;
        currentItem[fields.placementId] = currentPlacement.id;
        currentItem[fields.placementName] = currentPlacement.name;

        feedItems.push(currentItem);
      }

      return feedItems;
    }
  }
}
AdPlacementLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Ad Creative Loader
 */
var AdCreativeLoader = function(cmDAO) {
  this.label = 'Ad Creative Assignment';
  this.entity = 'Ads';
  this.tabName = ['Ad Creative Assignment', 'QA'];
  this.idField = fields.adId;
  this.listField = 'ads';
  this.keys = ['Ad ID', 'Creative ID'];

  BaseLoader.call(this, cmDAO);

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(ad) {
    if (!ad.creativeRotation || !ad.creativeRotation.creativeAssignments) {
      return null;
    }

    var creativeAssignments = ad.creativeRotation.creativeAssignments,
        feedItems = [], currentItem, currentCreative;

    for (var i = 0; i < creativeAssignments.length; i++) {
      currentItem = {};

      currentCreative =
          cmDAO.get('Creatives', creativeAssignments[i].creativeId);

      currentItem[fields.adId] = ad.id;
      currentItem[fields.adName] = ad.name;

      currentItem[fields.creativeId] = currentCreative.id;
      currentItem[fields.creativeName] = currentCreative.name;

      currentItem[fields.creativeRotationWeight] =
          creativeAssignments[i].weight;
      currentItem[fields.creativeRotationSequence] =
          creativeAssignments[i].sequence;

      currentItem[fields.landingPageId] =
          creativeAssignments[i].clickThroughUrl.landingPageId;

      currentItem[fields.customClickThroughUrl] =
          creativeAssignments[i].clickThroughUrl.customClickThroughUrl;

      if(creativeAssignments[i].startTime) {
        currentItem[fields.adCreativeAssignmentStartDate] =
            Utilities.formatDate(new Date(creativeAssignments[i].startTime), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ");
      }
      if(creativeAssignments[i].endTime) {
        currentItem[fields.adCreativeAssignmentEndDate] =
            Utilities.formatDate(new Date(creativeAssignments[i].endTime), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ");
      }

      feedItems.push(currentItem);
    }

    return feedItems;
  }
}
AdCreativeLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Ad Event Tag Loader
 */
var AdEventTagLoader = function(cmDAO) {
  this.label = 'Ad Event Tag Assignment';
  this.entity = 'Ads';
  this.tabName = 'Event Tag Ad Assignment';
  this.idField = fields.adId;
  this.listField = 'ads';

  BaseLoader.call(this, cmDAO);

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(ad) {
    if (!ad.eventTagOverrides) {
      return null;
    }

    var eventTagAssignments = ad.eventTagOverrides;
    var feedItems = [];

    for (var i = 0; i < eventTagAssignments.length; i++) {
      var currentItem = {};
      var eventTagAssignment = eventTagAssignments[i];
      var eventTag = cmDAO.get('EventTags', eventTagAssignment.id);

      currentItem[fields.eventTagId] = eventTag.id;
      currentItem[fields.eventTagName] = eventTag.name;
      currentItem[fields.adId] = ad.id;
      currentItem[fields.adName] = ad.name;
      currentItem[fields.enabled] = eventTagAssignment.enabled;

      feedItems.push(currentItem);
    }

    return feedItems;
  }
}
AdEventTagLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Placement Pricing Schedule Loader
 */
var PricingScheduleLoader = function(cmDAO) {
  this.label = 'Placement Pricing Schedule';
  this.entity = 'Placements';
  this.tabName = 'Placement Pricing Schedule';
  this.listField = 'placements';
  this.idField = fields.placementId;

  BaseLoader.call(this, cmDAO);

  /**
   * @see CampaignLoader.mapFeed
   */
  this.mapFeed = function(placement) {
    var feedItems = [];

    if(placement.pricingSchedule.pricingPeriods) {
      for(var i = 0; i < placement.pricingSchedule.pricingPeriods.length; i++) {
        var pricingPeriod = placement.pricingSchedule.pricingPeriods[i];

        var feedItem = {};

        feedItem[fields.placementName] = placement.name;
        feedItem[fields.placementId] = placement.id;
        feedItem[fields.pricingPeriodStart] = pricingPeriod.startDate;
        feedItem[fields.pricingPeriodEnd] = pricingPeriod.endDate;
        feedItem[fields.pricingPeriodRate] = pricingPeriod.rateOrCostNanos / 1000000000;
        feedItem[fields.pricingPeriodUnits] = pricingPeriod.units;

        feedItems.push(feedItem);
      }
    }

    return feedItems;
  }
}
PricingScheduleLoader.prototype = Object.create(BaseLoader.prototype);

/**
 * Returns a loader for a specific entity
 *
 * params:
 *  entity: the name of the entity
 *
 * returns: the loader for the specified entity
 */
function getLoader(entity) {
  return getLoaders()[entity];
}

/*
 * Gets the profile id from the Store tab
 *
 * returns: profile id
 */
function getProfileId() {
  return getSheetDAO().getValue('Store', 'B2');
}

/*
 * Gets the ActiveOnly flag from the store tab
 *
 * returns: boolean representing the value of the active flag
 */
function getActiveOnlyFlag() {
  return getSheetDAO().getValue('Store', 'B5');
}

/**
 * Given lists of CM objects builds a hierarchy
 * params:
 *  job.campaigns: List of campaigns
 *  job.placements: List of placements
 *  job.placementGroups: List of placement groups
 *  job.ads: List of ads
 *  job.landingPages: List of Landing Pages
 *  job.creatives: List of creatives
 *  job.eventTags: List of event tags
 *
 * returns: job.hierarchy, a list of campaigns with the hierarchy underneath
 */
function doBuildHierarchy(job) {
  job.hierarchy = [];

  if(!job.logs) {
    job.logs = [];
  }

  job.logs.push([new Date(), 'Building CM entity hierarchy']);

  var creativesMap = {};
  forEach(job.creatives, function(index, creative) {
    creativesMap[creative.id] = creative;
  });

  var lpMap = {};
  forEach(job.landingPages, function(index, landingPage) {
    lpMap[landingPage.id] = landingPage;
  });

  var campaignMap = {};
  forEach(job.campaigns, function(index, campaign) {
    console.log('campaign:' + campaign.id);
    job.hierarchy.push(campaign);

    campaign.placements = [];
    campaign.placementGroups = [];

    campaignMap[campaign.id] = campaign;
  });

  var pgMap = {};
  forEach(job.placementGroups, function(index, placementGroup) {
    console.log('placementGroup:' + placementGroup.id);
    placementGroup.placements = [];

    pgMap[placementGroup.id] = placementGroup;

    if(campaignMap[placementGroup.campaignId]) {
      campaignMap[placementGroup.campaignId].placementGroups.push(placementGroup);
    }
  });

  var placementMap = [];
  forEach(job.placements, function(index, placement) {
    console.log('placement:' + placement.id);

    placement.ads = [];
    if(placement.placementGroupId && pgMap[placement.placementGroupId]) {
      pgMap[placement.placementGroupId].placements.push(placement);
    } else if(placement.campaignId && campaignMap[placement.campaignId]) {
      campaignMap[placement.campaignId].placements.push(placement);
    }

    placementMap[placement.id] = placement;
  });

  forEach(job.ads, function(index, ad) {
    console.log('ad:' + ad.id);

    forEach(ad.placementAssignments, function(index, assignment) {
      if(placementMap[assignment.placementId]) {
        placementMap[assignment.placementId].ads.push(ad);
      }
    });

    ad.creatives = [];
    forEach(ad.creativeRotation.creativeAssignments, function(index, assignment) {
      console.log('creative rotation');
      ad.creatives.push(assignment);

      assignment.creative = creativesMap[assignment.creativeId];

      var landingPageId = null;
      if(assignment.clickThroughUrl.defaultLandingPage) {
        landingPageId = campaignMap[ad.campaignId].defaultLandingPageId;
      } else {
        landingPageId = assignment.clickThroughUrl.landingPageId;
      }

      assignment.landingPage = lpMap[landingPageId];
    });
  });

  return job;
}

// CM DAO used by all loaders

// Map of loaders used by getLoader
var loaders;
function getLoaders() {
  var cmDAO = new CampaignManagerDAO(getProfileId());
  if(!loaders) {
    loaders = {
      'Campaigns': new CampaignLoader(cmDAO),
      'AdvertiserLandingPages': new LandingPageLoader(cmDAO),
      'EventTags': new EventTagLoader(cmDAO),
      'Creatives': new CreativeLoader(cmDAO),
      'PlacementGroups': new PlacementGroupLoader(cmDAO),
      'Placements': new PlacementLoader(cmDAO),
      'Ads': new AdLoader(cmDAO),
      'PlacementPricingSchedule': new PricingScheduleLoader(cmDAO),
      'AdCreativeAssignment': new AdCreativeLoader(cmDAO),
      'AdPlacementAssignment': new AdPlacementLoader(cmDAO),
      'AdEventTagAssignment': new AdEventTagLoader(cmDAO)
    }
  }

  return loaders;
}
