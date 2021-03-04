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
 *  keys: string | list of strings: Name of the column or columns that should be
 *  used to uniquely identify a row in the feed. This is used to dedup rows for
 *  a given entity, which is useful when pushing data from the QA tab to CM. If
 *  no key is defined, every row is returned and no deduping happens.
 */
var FeedProvider = function(tabName, keys) {

  var sheetDAO = getSheetDAO();
  var _index = -1;
  var _feed = null;

  if(keys && !Array.isArray(keys)) {
    keys = [keys];
  }

  /**
   * Based on the key fields defined in the keys constructor parameter, returns
   * the key for a given feed item.
   *
   * params:
   *  feedItem: feed item to genetare the key for.
   */
  function generateKey(feedItem) {
    var result = [];

    forEach(keys, function(index, key) {
      if(feedItem[key]) {
        result.push(feedItem[key]);
      }
    });

    return result.join('|');
  }

  /**
   * Applies changes to all duplicated items and re-dups feed so it can be
   * written back to the sheet
   *
   * returns: feed ready to be written back to the sheet
   */
  function applyChanges() {
    var result = [];

    if(!keys) {
      return _feed;
    } else {
      forEach(_feed, function(index, feedItem) {
        var original = feedItem._original;
        var changes = {};

        result.push(feedItem);

        forEach(Object.getOwnPropertyNames(feedItem), function(index, propertyName) {
          if(propertyName[0] != "_") {
            if(original[propertyName] !== feedItem[propertyName]) {
              changes[propertyName] = feedItem[propertyName];
            }
          }
        });

        forEach(feedItem._dups, function(index, dupFeedItem) {
          forEach(Object.getOwnPropertyNames(changes), function(index, propertyName) {
            dupFeedItem[propertyName] = changes[propertyName];
          });

          result.push(dupFeedItem);
        });
      });
    }

    return result;
  }

  /**
   * Loads feed from the sheet
   */
  this.load = function() {
    if(tabName) {
      this.setFeed(sheetDAO.sheetToDict(tabName));
    }

    return this;
  }

  /**
   * Is the feed empty?
   *
   * returns: true if the feed is empty, false otherwise
   */
  this.isEmpty = function() {
    return _feed && _feed.length > 0;
  }

  /**
   * Resets the feedProvider to the first item in the feed
   */
  this.reset = function() {
    _index = -1;

    return this;
  }

  /**
   * Sets a feed to this provider
   */
  this.setFeed = function(feed) {
    if(!keys) {
      _feed = feed;
    } else {
      _feed = [];
      feedMap = {};

      forEach(feed, function(index, feedItem) {
        if(feedItem._deduped) {
          _feed.push(feedItem);
        } else {
          var key = generateKey(feedItem) || 'unkeyed';

          feedItem._deduped = true;

          if(key === 'unkeyed') {
            feedItem.unkeyed = true;
          }

          if(feedMap[key]) {
            feedMap[key]._dups.push(feedItem);
          } else {
            feedItem._original = JSON.parse(JSON.stringify(feedItem));
            feedItem._dups = [];
            feedMap[key] = feedItem;
            _feed.push(feedItem);
          }
        }
      });
    }

    return this;
  }

  /**
   * Returns the next feed item, or null if no more items are available
   *
   *  returns: feed item
   */
  this.next = function() {
    if(_feed) {
      _index++;

      /*
      if(keys) {
        for(;_index < _feed.length && !generateKey(_feed[_index]); _index++);
      }
      */

      if(_index < _feed.length) {
        return _feed[_index];
      }
    }

    return null;
  }

  /**
   * Writes feed back to the sheet
   */
  this.save = function() {
    if(_feed && tabName) {
      var rawFeed = applyChanges();
      sheetDAO.clear(tabName, "A2:AZ");
      sheetDAO.dictToSheet(tabName, rawFeed);
      this.setFeed(rawFeed);
    }

    return this;
  }

}
