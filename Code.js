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
 * This module sets up and displays Bulkdozer menus, as well as defines
 * functions that implement menu functionality
 */

/**
 * onOpen handler to display Bulkdozer menu
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createMenu('Bulkdozer')
      .addItem('Bulkdozer', 'bulkdozer')
      .addToUi();
}

/**
 * Bulkdozer menu that displays the sidebar
 */
function bulkdozer() {
  var html = HtmlService.createTemplateFromFile('Bulkdozer')
      .evaluate()
      .setTitle('Bulkdozer');

  SpreadsheetApp.getUi().showSidebar(html);
}

