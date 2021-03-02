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
 * Handles all interactions with the sheet, such as reading data, writing data,
 * clearing ranges, etc.
 */
var SheetDAO = function() {
  // PRIVATE FIELDS

  // Allows private methods to access this object
  var that = this;

  // Defines the maximun number of columns to consider in a sheet
  const MAX_SHEET_WIDTH = 52;

  // Column names to facilitate index to a1 notation syntax translation
  var columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD',
    'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR',
    'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ'];

  this.columns = columns;


  // Object that holds sheet cache in memory
  var sheetCache = {};

  // PRIVATE METHODS

  /**
   * Turns a feed item into a sheet row based on the fiels in the header
   *
   * params:
   *  header: array of strings representing the headers of the sheet
   *  item: the feed item to write, a dictionary with fields that match the
   *  header fields
   *
   * returns: array of values to be written to the sheet
   */
  function dictToRow(header, item) {
    var result = [];

    for(var i = 0; i < header.length; i++) {
      var value = item[header[i]];

      if(value !== undefined && value !== null) {
        result.push(item[header[i]].toString());
      } else {
        result.push(null);
      }
    }

    return result;
  }

  /**
   * Gets the header row of a sheet
   *
   * params:
   *  sheetName: name of the sheet to get the header
   *
   * returns: Array representing each column of the header row of the identified
   * sheet
   */
  function getHeader(sheetName) {
    var result = cacheGet(sheetName, 'header');

    if(!result) {
      var sheet = getSheet(sheetName);
      var header = sheet.getSheetValues(1, 1, 1, MAX_SHEET_WIDTH)[0];
      var result = [];

      for(var i = 0; i < header.length && header.slice(i).join(''); i++) {
        result.push(header[i]);
      }

      if(!sheetCache[sheetName]) {
        sheetCache[sheetName] = {};
      }

      cachePut(sheetName, 'header', result);
    }

    return result;
  }

  /**
   * Gets data from a sheet
   *
   * params:
   *  sheetName: name of the sheet from which to get the data
   */
  function getData(sheetName) {

    var result = cacheGet(sheetName, 'data');

    if(!result) {
      var header = getHeader(sheetName);
      var data;

      data = that.getValues(sheetName, 'A2:' + columns[header.length + 1]);
      result = [];

      for(var i = 0; i < data.length; i++) {
        var row = data[i];

        if(row.join('')) {
          result.push(row);
        } else {
          break;
        }
      }

      cachePut(sheetName, 'data', result);
    }

    return result;
  }

  /**
   * Returns a list with all sheets, uses cache for performance reasons
   *
   * returns: Array of sheets
   */
  function getSheets() {
    var result = cacheGet('all', 'sheets');

    if(!result) {
      result = SpreadsheetApp.getActive().getSheets();

      cachePut('all', 'sheets', result);
    }

    return result;
  }

  /**
   * Gets the sheet object that represents a given sheet
   *
   * params:
   *  sheetName: Name of the sheet to return
   *
   * returns: The sheet object
   */
  function getSheet(sheetName) {
    var result = cacheGet(sheetName, 'sheet');

    if(!result) {
      var sheets = getSheets();

      for(var i = 0; i < sheets.length; i++) {
        var sheet = sheets[i];

        if(sheet.getName() === sheetName) {
          result = sheet;
          break;
        }
      }

      cachePut(sheetName, 'sheet', result);
    }

    return result;
  }

  /**
   * Fetches data from the cache
   *
   * params:
   *  sheetName: The cache is sheet based, this is the name of the sheet used to
   *  identify the cache
   *  key: key within the sheet cache to fetch
   *
   * returns: The value from the cache if there is a value that matches the
   * sheetName and key, null otherwise
   */
  function cacheGet(sheetName, key) {
    if(sheetCache[sheetName] && sheetCache[sheetName][key]) {
      return sheetCache[sheetName][key];
    }

    return null;
  }

  /**
   * Puts data into the sheet cache
   *
   * params:
   *  sheetName: The cache is sheet based, this is the name of the sheet used to
   *  identify the cache
   *  key: key within the sheet cache to put
   *  value: value to put in the cache
   */
  function cachePut(sheetName, key, value) {
    if(!sheetCache[sheetName]) {
      sheetCache[sheetName] = {};
    }

    sheetCache[sheetName][key] = value;
  }

  /**
   * Returns a range object representing the specified range. This method will
   * cache the range for performance reasons avoiding multiple calls to the API
   *
   * params:
   *  sheetName: name of the tab
   *  range: A1 notation of the range
   *
   * returns: Range object representing the identified range
   */
  function getRange(sheetName, range) {
    var result = cacheGet(sheetName, range);

    if(!result) {
      var sheet = getSheet(sheetName);

      if(sheet) {
        result = sheet.getRange(range);

        cachePut(sheetName, range, result);
      }
    }

    return result;
  }

  /**
   * Turns a row into a dictionary based on the field specification of a header
   * row
   *
   * params:
   *  header: array representing the header of the sheet
   *  row: row with data
   *
   * returns: dictionary with each field in the header and data from row
   */
  function rowToDict(header, row) {
    var result = {};

    for(var i = 0; i < header.length; i++) {
      result[header[i]] = row[i];
    }

    return result;
  }

  // PUBLIC METHODS

  this.isQA = function() {
    return getSheet('QA') != null;
  }
  /**
   * Clears a range in the sheet
   *
   * params:
   *  sheetName: Name of the sheet to clear
   *  range: range within the sheet to clear
   */
  this.clear = function(sheetName, range) {
    var range = getRange(sheetName, range);

    if(range) {
      range.clear();
    }
  }

  /**
   * Opens the specified tab
   *
   * params:
   *  sheetName: The name of the tab to open
   */
  this.goToTab = function(sheetName) {
    console.log('going to tab ' + sheetName);
    SpreadsheetApp.setActiveSheet(SpreadsheetApp.getActive().getSheetByName(sheetName));
  }

  /**
   * Turns a sheet into a dictionary with each field name being the column header
   * which is assumed to be row 1 of the sheet
   *
   * params:
   *  sheetName: name of the sheet to transform
   *  noCache: boolean, if true the cache isn't used, otherwise cache is used
   */
  this.sheetToDict = function(sheetName, noCache) {
    if(!this.tabExists(sheetName)) {
      return [];
    }

    var result = noCache ? null : cacheGet(sheetName, 'dict');

    if(!result) {
      var header = getHeader(sheetName);
      var data = getData(sheetName);
      var result = [];

      for(var i = 0; i < data.length && data[i].join('') != ''; i++) {
        result.push(rowToDict(header, data[i]));
      }

      cachePut(sheetName, 'dict');
    }

    return result;
  }

  /**
   * Checks if a tab exists
   *
   * params:
   *  tabName: name of the tab to check
   *
   * returns: true if exists, false otherwise
   */
  this.tabExists = function(tabName) {
    return getSheet(tabName) ? true : false;
  }

  /**
   * Gets data from a particular range in a spreadsheet
   *
   * params:
   *  sheetName: Name of the sheet (tab) from which to read the data
   *  range: Range in the sheet from which to get the data
   *
   * returns: array of arrays with the values identified
   */
  this.getValues = function(sheetName, range) {
    var result = cacheGet(sheetName, 'values' + range);

    if(!result) {
      var range = getRange(sheetName, range);

      var result = _retry(function() {
        return range.getValues();
      }, 3, 2 * 1000);

      cachePut(sheetName, 'values' + range, result);
    }

    return result;
  }

  /**
   * Returns a single value from a cell in the sheet
   *
   * params:
   *  sheetName: Name of the sheet to read from
   *  range: a1 notation of a specific cell
   */
  this.getValue = function(sheetName, range) {
    var values = this.getValues(sheetName, range);

    if(values.length > 0 && values[0].length > 0) {
      return values[0][0];
    }

    return null;
  }

  /**
   * Write values to a particular sheet and range
   *
   * params:
   *  sheetName: Name of the sheet where to write
   *  range: range in which to write
   *  values: array of arrays containing values to write
   */
  this.setValues = function(sheetName, range, values) {
    var sheetRange = getRange(sheetName, range);

    sheetRange.clear();

    var response = _retry(function() {
      sheetRange.setValues(values);
    }, 3, 2 * 1000);
  }

  /**
   * Writes a feed to a sheet
   *
   * params:
   *  sheetName: name of the sheet in which to write the feed
   *  items: list of items in the feed format to write to the sheet
   */
  this.dictToSheet = function(sheetName, items) {
    var header = getHeader(sheetName);

    this.clear(sheetName, '!A2:AZ');

    var rows = [];

    for(var i = 0; i < items.length; i++) {
      rows.push(dictToRow(header, items[i]));
    }

    if(rows.length > 0) {
      this.setValues(sheetName, '!A2:' + columns[rows[0].length - 1] + (rows.length + 1), rows);
    }
  }
}

// Singleton implementation for the sheet dao
var sheetDAO;
function getSheetDAO() {
  if(!sheetDAO) {
    sheetDAO = new SheetDAO();
  }

  return sheetDAO;
}

