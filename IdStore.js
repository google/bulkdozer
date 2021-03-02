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
 * Handles the id store which is used for translating ext ids into concrete ids
 * across multiple bulkdozer executions
 */
var IdStore = function(sheetDAO) {

  // Maximun number of characters to be written per cell
  var CELL_CHAR_LIMIT = 50000;

  // Dictionary used for mapping the ids
  var store;

  /**
   * Translates an id, returns null if the id isn't found
   * params:
   *  tabName: name of the sheet for which to translate ids
   *  id: id to translate
   *
   * returns: translated id, if ext returns concrete id, if concrete id returns
   * ext
   */
  this.translate = function(tabName, id) {
    if(store[tabName] && store[tabName][id]) {
      return store[tabName][id];
    }

    return null;
  }

  /**
   * Adds an id to the store
   *
   * params:
   *  tabName: name of the sheet tab for the id
   *  id: id to map
   *  extId: ext id to map
   */
  this.addId = function(tabName, id, extId) {
    if(!store[tabName]) {
      store[tabName] = {}
    }

    store[tabName][id] = extId;
    store[tabName][extId] = id;
  }

  /**
   * Saves store to the sheet
   */
  this.store = function() {
    var raw = JSON.stringify(store);
    var values = [];

    sheetDAO.clear('Store', 'A1:Z1');

    for(var i = 0; i < raw.length; i += CELL_CHAR_LIMIT) {
      values.push(raw.substring(i, i + CELL_CHAR_LIMIT));
    }

    if(values.length == 0) {
      values.push('{}');
    }

    sheetDAO.setValues('Store', 'A1:' + sheetDAO.columns[values.length - 1]  + '1', [values]);
  }

  /**
   * Loads the store from the sheet
   */
  this.load = function() {
    var values = sheetDAO.getValues('Store', 'A1:Z1');
    var raw = '';

    for(var i = 0; i < values[0].length && values[0][i]; i++) {
      raw += values[0][i];
    }

    if(!raw) {
      raw = '{}';
    }

    store = JSON.parse(raw);
  }

  /**
   * Clears the store
   */
  this.clear = function() {
    store = {};
    this.store();
  }

  /**
   * Initializes the store with existing data
   *
   * params:
   *  data: The data to use to initialize the store
   */
  this.initialize = function(data) {
    store = data;
  }

  /**
   * Returns internal representation of this object for persistence
   */
  this.getData = function() {
    return store;
  }
}

// Singleton implementation for the idStore
var idStore;
function getIdStore() {
  if(!idStore) {
    idStore = new IdStore(new SheetDAO());
  }

  return idStore;
}
