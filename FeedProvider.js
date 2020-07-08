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
 */
var FeedProvider = function(tab) {

  var sheetDAO = getSheetDAO();
  var index = -1;
  var _feed = null;
  var tabName = null;

  if(!Array.isArray(tab)) {
    tab = [tab];
  }

  forEach(tab, function(index, value) {
    if(!tabName && sheetDAO.tabExists(value)) {
      tabName = value;
    }
  });

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
    index = -1;

    return this;
  }

  /**
   * Sets a feed to this provider
   */
  this.setFeed = function(feed) {
    _feed = feed;

    return this;
  }

  /**
   * Returns the next feed item, or null if no more items are available
   *
   *  returns: feed item
   */
  this.next = function() {
    if(_feed) {
      index++;

      if(_feed && index < _feed.length) {
        return _feed[index];
      }
    }

    return null;
  }

  /**
   * Writes feed back to the sheet
   */
  this.save = function() {
    if(_feed && tabName) {
      sheetDAO.clear(tabName, "A2:AZ");
      sheetDAO.dictToSheet(tabName, _feed);
    }

    return this;
  }

}
