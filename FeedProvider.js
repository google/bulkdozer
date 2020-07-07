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
 * Feed provider reads and writes feed items to the sheet, it implements and
 * iterator like interface to simplify the process of looping through and
 * updating feed items
 *
 * params:
 *  tab: string | list of strings: Name of the tab to read and write the feed.
 *  It can be a string representing the name of the tab, or a list of strings to
 *  be used in order of priority, i.e. if a list the first tab that exists will
 *  be used, this is helpful in case of falling back to a different tab, for
 *  instance the QA tab.
 *
 *  keys: list of strings with field names to be used as keys to uniquely
 *  identify a row of the feed
 */
var FeedProvider = function(tab, keys) {

  var sheetDAO = getSheetDAO();
  var index = -1;
  var _feed = null;
  var tabName = null;

  if(!Array.isArray(tab)) {
    tab = [tab];
  }

  forEach(tab, function(index, value) {
    if(sheetDAO.tabExists(value)) {
      tabName = value;
    }
  });

  function generateKey(feedItem) {
    if(!feedItem) {
      return null;
    }

    var result = [];

    forEach(keys, function(index, key) {
      result.push(feedItem[key]);
    });

    return result.join('|');
  }

  /**
   * Loads feed from the sheet
   */
  this.load = function() {
    if(tabName) {
      this.setFeed(sheetDAO.feedToDict(tabName));
    }
  }

  /**
   * Sets a feed to this provider
   */
  this.setFeed = function(feed) {
    index = -1;

    _feed = {};

    forEach(feed, function(index, feedItem) {
      var key = generateKey(feedItem);
      if(!_feed[key]) {
        _feed[key] = [];
      }

      _feed[key].push(feedItem);
    });
  }

  /**
   * Returns the next feed item, or null if no more items are available
   *
   *  returns: feed item
   */
  this.next = function() {
    if(_feed) {
      index++;
      var keys = _feed.keys();

      if(_feed && index < keys.length) {
        // TODO: Find out a way to update the duplicate records so that changes are
        // applied across the feed and not just to the first item
        return _feed[keys[index][0]];
      }
    }

    return null;
  }

  /**
   * Writes feed back to the sheet
   */
  this.save = function() {
    if(_feed) {
      var rawFeed = [];

      forEach(_feed.keys(), function(index, key) {
        rawFeed = rawFeed.concat(_feed[key]);
      });

      sheetDAO.clear(tabName, "A2:AZ");
      sheetDAO.feedToDict(tabName, rawFeed);
    }
  }

}
