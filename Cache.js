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

// Use this to use in memory cache, it is not shared across jobs, and it may
// exceed the apps script memory limit, but it is significantly faster
var DEFAULT_CACHE_MODE = 'MEMORY';

// Use this to use the Apps Script cache service, it is shared across jobs and
// it automatically evicts items to avoid exceeding limits, but it is slower
//var DEFAULT_CACHE_MODE = 'SERVICE';

/** Singleton instance of cache */
var cache = null;

/** In memory cache */
var InMemoryCache = function() {
  cache = {};

  /** Gets an item from the cache
   *
   * params:
   *  key: The key to the item in the cache
   *
   * returns: The item identified by the key in the cache, or null if not found
   */
  this.get = function(key) {
    return cache[key];
  }

  this.put = function(key, item) {
    cache[key] = item;
  }
}

function getCache(mode) {
  mode = mode || DEFAULT_CACHE_MODE;
  if(!cache) {
    if(mode == 'SERVICE') {
      cache = CacheService.getUserCache();
    } else if(mode == 'MEMORY') {
      cache = new InMemoryCache();
    }
  }

  return cache;
}
