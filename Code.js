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

const DEFAULT_SLEEP = 8 * 1000;
const DEFAULT_RETRIES = 4;

// Declare context object so we can call functions by name, this enables
// configuration based functionality, so the tool behaves according to settings
// defined in the sheet.
var context = this;

/**
 * onOpen handler to display Bulkdozer menu
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('Bulkdozer')
      .addItem('Open', 'bulkdozer')
      .addToUi();
}

/**
 * Bulkdozer menu that displays the sidebar
 */
function bulkdozer() {
  var html = null;
  if(getSheetDAO().isQA()) {
    var html = HtmlService.createTemplateFromFile('BulkdozerQA')
        .evaluate()
        .setTitle('Bulkdozer');
  } else {
    var html = HtmlService.createTemplateFromFile('Bulkdozer')
        .evaluate()
        .setTitle('Bulkdozer');
  }

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * For each implementation, invokes func(index, item) for each item in the list
 * list: Array of items to iterate
 * func: function that takes integer index and item as parameters
 */
function forEach(items, func) {
  if(Array.isArray(items)) {
    for(var i = 0; i < items.length; i++) {
      if(func) {
        func(i, items[i]);
      }
    }
  }
}

/**
* Given an error raised by an API call, determines if the error has a chance
* of succeeding if it is retried. A good example of a "retriable" error is
* rate limit, in which case waiting for a few seconds and trying again might
* refresh the quota and allow the transaction to go through. This method is
* desidned to be used by the _retry function.
*
* params:
* error: error to verify
*
* returns: true if the error is "retriable", false otherwise
*/
function isRetriableError(error) {
  var retriableErroMessages = [
      'failed while accessing document with id',
      'internal error',
      'user rate limit exceeded',
      'quota exceeded',
      '502',
      'try again later',
      'failed while accessing document',
      'empty response'
  ];

  var message = null;
  var result = false;

  if(error) {
    if(typeof(error) == 'string') {
      message = error;
    } else if(error.message) {
      message = error.message;
    } else if(error.details && error.details.message) {
      message = error.details.message;
    }

    message = message ? message.toLowerCase() : null;
  }

  if(message) {
    retriableErroMessages.forEach(function(retriableMessage) {
      if(message.indexOf(retriableMessage) != -1) {
        result = true;
      }
    });
  }

  return result;
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

