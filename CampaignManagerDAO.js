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
  const DEFAULT_SLEEP = 8 * 1000;
  const DEFAULT_RETRIES = 4;
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
   * Given an error raised by an API call, determines if the error has a chance
   * of succeeding if it is retried. A good example of a "retriable" error is
   * rate limit, in which case waiting for a few seconds and trying again might
   * refresh the quota and allow the transaction to go through. This method is
   * desidned to be used by the _retry function.
   *
   * params:
   *  error: error to verify
   *
   * returns: true if the error is "retriable", false otherwise
   */
  function isRetriableError(error) {
    if(error && error.message) {
      return error.message.toLowerCase().indexOf('user rate limit exceeded') != -1;
    }

    return false;
  }

  /**
   * Wrapper to add retries and exponential backoff on API calls
   *
   * params:
   *  fn: function to be invoked, the return of this funcntion is returned
   *  retries: Number of ties to retry
   *  sleep: How many milliseconds to sleep, it will be doubled at each retry.
   *
   * returns: The return of fn
   */
  function _retry(fn, retries, sleep) {
    try {
      var result = fn();
      return result;
    } catch(error) {
      if(isRetriableError(error) && retries > 0) {
        Utilities.sleep(sleep);
        return _retry(fn, retries - 1, sleep * 2);
      } else {
        throw error;
      }
    }
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
        response = _retry(function() {
          return DoubleClickCampaigns[entity].list(profileId, {'pageToken': response.nextPageToken});
        }, DEFAULT_RETRIES, DEFAULT_SLEEP);
      } else {
        response = null;
      }
    }

    return result;
  }

  // PUBLIC METHODS
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
    var result;
    var cacheKey = getListCacheKey(entity, listName, options);

    if (listCache[cacheKey]) {
      result = listCache[cacheKey];
    } else {
      console.log('Invoking API to list ' + entity);
      result = fetchAll(entity, listName, options);

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


}
