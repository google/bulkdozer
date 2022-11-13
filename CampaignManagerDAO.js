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

/**
* Object responsible for all interactions with the Campaign Manager API
*
* params:
*  profileId: The profile id to be used to access the Campaign Manager API
*/
var CampaignManagerDAO = function(profileId) {
  // PRIVATE FIELDS
  // 8 seconds default sleep, 4 retries, waiting twice as long for each retry.
  // This means that the total wait time in the worst case scenario is 248
  // seconds, or just over 4 minutes, ensuring the retries will be exhausted
  // within the 5 minutes runtime
  const CACHE_EXPIRATION = 21600;

  var cache = getCache();
  var listCache = {};
  var userProperties = PropertiesService.getUserProperties();
  var jobId = userProperties.getProperty('jobId');

  function getCacheKey(entity, id) {
    return entity + '|' + id + '|' + jobId;
  }

  // PRIVATE METHODS
  function getListCacheKey(entity, listName, options) {
    var result = entity;

    if(options) {
      result += JSON.stringify(options);
    }

    return result;
  }

  /**
   * Fetches items from Campaign Manager based on the provided parameters and it
   * handles pagination by fetching all pages. This uses the list method of the
   * API
   *
   * params:
   *  entity: The name of the Campaign Manager API entity
   *  listName: Name of the list returned by the API
   *  options: Additional options to be passed to the list API call
   *
   * returns: Array with all items that match the specified search
   */
  function fetchAll(entity, listName, options) {
    var response = _retry(function() {
      return DoubleClickCampaigns[entity].list(profileId, options)
    }, DEFAULT_RETRIES, DEFAULT_SLEEP);
    var result = [];

    while (response && response[listName] && response[listName].length > 0) {
      result = result.concat(response[listName]);

      if (response.nextPageToken) {
        if(!options['ids']) {
          // Possible bug. Keep sending options to filter the request such as campaignId, etc., in each call since the API 'loses' the params and starts retrieving
          // elements in higher hierarchies, for example creatives at advertiser level instead of campaign level.
          options['pageToken'] = response.nextPageToken;
        } else {
          // Don't do it when sending ids[] to filter the request since there is a 400 error about sending > 500 ids
          options = {'pageToken': response.nextPageToken};
        }
        response = _retry(function() {
          return DoubleClickCampaigns[entity].list(profileId, options);
        }, DEFAULT_RETRIES, DEFAULT_SLEEP);
      } else {
        response = null;
      }
    }

    return result;
  }

  // PUBLIC METHODS

  /**
   * Sets the cache object to be used by this instance. This allows for
   * controlling which type of cache to use, e.g. in memory or cache service.
   *
   * params:
   *  newCache: Object to be used for caching
   */
  this.setCache = function(newCache) {
    cache = newCache;
  }

  /**
   * Fetches a list of items from CM
   *
   * params:
   *  entity: The name of the Campagign Manager API entity
   *  listName: The name of the list returned by the API
   *  options: Any additional option that should be passed to the list call
   *
   * returns: List of items returned from the API
   */
  this.list = function(entity, listName, options) {
    var result = [];
    var cacheKey = getListCacheKey(entity, listName, options);

    if (listCache[cacheKey]) {
      result = listCache[cacheKey];
    } else {
      console.log('Invoking API to list ' + entity);

      // Check for ids present in the search options
      // to create batches if length > 500
      if(!options['ids']) {
        result = fetchAll(entity, listName, options);
      } else {
        let batches = createBatches(options['ids']);
        // Make API calls in batches to avoid the 500 ids limit error
        for(let i = 0; i < batches.length; i++) {
          options['ids'] = batches[i];
          result = result.concat(fetchAll(entity, listName, options));
        }
      }

      listCache[cacheKey] = result;

      for (var i = 0; i < result.length; i++) {
        var item = result[i];

        if (JSON.stringify(item).length < 100000 && item['id']) {
          cache.put(getCacheKey(entity, item['id']), item, CACHE_EXPIRATION);
        }
      }
    }

    return result;
  }

  /**
   * Creates batches of 500 ids for the search options query params
   *
   * params:
   *  ids: the id list in the search options obj
   */
  function createBatches(ids) {
    let batches = [];
    let tempArray;
    let limit = 500;
    for (let i = 0, j = ids.length; i < j; i += limit) {
        tempArray = ids.slice(i, (i + limit));
        batches.push(tempArray);
    }
    return batches;
  }

  /**
   * Fetches a specific item from Campaign Manager. This method uses cache
   *
   * params:
   *  entity: the entity name on the Campaign Manager API
   *  id: the id of the item to fetch
   */
  this.get = function(entity, id) {
    if (!id) {
      return null;
    }

    if (cache.get(getCacheKey(entity, id))) {
      return JSON.parse(cache.get(getCacheKey(entity, id)));
    } else {
      console.log('Invoking API to fetch ' + entity);
      var result = _retry(function() {
        return DoubleClickCampaigns[entity].get(profileId, id);
      }, DEFAULT_RETRIES, DEFAULT_SLEEP);

      if (result) {
        cache.put(getCacheKey(entity, id), result);
      }

      return result;
    }
  }

  /**
   * Inserts or updates item in Campaign Manager
   *
   * params:
   *  entity: the name of the Campaign Manager entity
   *  obj: Object to insert or update
   */
  this.update = function(entity, obj) {
    console.log('Updating entity ' + entity);
    console.log('entity id: ' + obj.id);
    if(obj.id) {
      return _retry(function() {
        return DoubleClickCampaigns[entity].update(obj, profileId);
      }, DEFAULT_RETRIES, DEFAULT_SLEEP);
    } else {
      return _retry(function() {
        return DoubleClickCampaigns[entity].insert(obj, profileId);
      }, DEFAULT_RETRIES, DEFAULT_SLEEP);
    }
  }

  /**
   * Associates a creative to a campaign
   *
   * params:
   *  campaignId: The ID of the campaign to associate the creative with
   *  creativeId: The ID of the creative to associate
   */
  this.associateCreativeToCampaign = function(campaignId, creativeId) {

    var resource = {
      'creativeId': creativeId
    }

    _retry(function() {
      DoubleClickCampaigns.CampaignCreativeAssociations.insert(resource, profileId, campaignId);
    }, DEFAULT_RETRIES, DEFAULT_SLEEP);
  }

  /**
   * Fetches a list of Campaign Manager Sizes that match the width and height
   * specified.
   *
   * params:
   *  width: width of the Size to search
   *  height: height of the Size to search
   *
   * returns: List of sizes that match width and height specified.
   */
  this.getSize = function(width, height) {
    return _retry(function() {
      return DoubleClickCampaigns.Sizes.list(profileId, {
        'height': height,
        'width': width
      }).sizes;
    }, DEFAULT_RETRIES, DEFAULT_SLEEP);
  }

  /**
   * Fetches items of a given entity based on a list of ids. Since CM has a
   * limitation of 500 ids per "list" call, this method splits the ids in chunks
   * of up to 500 items and merges the result.
   *
   * params:
   *  entity: Name of the CM entity to fetch
   *  listName: Name of the list field returned by the api
   *  ids: Array of integers representing the ids to fetch
   *
   * returns: Array of entities returned by CM
   */
  this.chunkFetch = function(entity, listName, ids) {
    var result = [];

    for(var i = 0; i < ids.length; i += 500) {
      var chunk = ids.slice(i, i + 500);

      result = result.concat(this.list(entity, listName, {'ids': chunk}));
    }

    return result;
  }

}
