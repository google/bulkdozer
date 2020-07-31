# Floodlight Audit Tool

The Floodlight Audit tool is a chrome extension that crawls a website and
generates a floodlight tag report by monitoring network traffic from the page.

In this document, we will be outlining the installation, base functionality,
features and way to use the floodlight audit tool that may come up in most use
cases.

This is not an officially supported Google product.

## License

Copyright 2017 Google LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.

Note that these code samples being shared are not official Google products and
are not formally supported.

## Installation

1.  Download/pull the source code to a local directory of your choosing.
2.  Rename the manifest.json.template file at the root directory of the code to
    manifest.json.
3.  Open a chrome browser window, navigate the extensions management page by
    browsing to: chrome://extensions/
4.  On the top right of the page flip the "Developer Mode" switch to on.
5.  At the top of the page, on the left, click the “Load Unpacked Extension ...”
    button
6.  Select the “floodlight-audit” folder created when you downloaded the source
    code.
7.  The tool should now be installed, and a new icon should show in the
    extensions toolbar on the top right corner of chrome.
8.  Finally click the icon in the extension toolbar to open the tool.

If the extension doesn't work due to chrome extensions restrictions in your
organization you may be need to generate a key, follow instructions here: https://developer.chrome.com/apps/manifest/key

Add a new "key" field in manifest.json and set the value to your key.

## User Interface

In this section we are going to outline the functionality of each element within
the Control panel.

1.  *Domain* - Displays the top level domain for the website in the tab the tool
    was open in. Used to verify that scraped on each page by the tool fall
    within the same domain.

2.  *ProfileID* (optional) - Represents the user’s Campaign Manager(CM) Profile
    ID. This field is optional as it is not needed to run the audit. If filled
    out (along with CM Account ID) when floodlights are captured by the tool, a
    link will be created for each entry that will take the user to the CM page
    for that floodlight.

3.  *CM Account ID* (optional) - Represents the Campaign Manager network account
    ID. Similarly to ProfileID, this field is optional as it is not needed to
    run the audit and if filled out with Profile ID it will allow the tool to
    generate a link to the floodlight within the CM UI.

4.  *Floodlight Configuration ID* (optional) - This field can be filled out with
    (1 or more) comma separated floodlight configuration IDs on which to filter
    the audit run on a site. Only floodlights IDs present in this field will be
    recorded during the audit. This helps scope down the audit to specific
    floodlights that a user may want to test. If empty then all floodlights will
    be recorded.

5.  *URL Suffix* (optional) - Any value added to this field will be appended to
    every URL visited by the extension.

6.  *Enable Manual Mode* - (defaults to off) If checked, the tool will run the
    audit in manual mode meaning that it will not automatically visit and scrape
    web pages. Instead it will sit back passively and record any floodlight
    light activity as the user navigates through the website. Allows a user to
    audit particular pages, simulate a customer actions that would fire flood
    lights which a page visit may not (button click, sign up, etc...) or
    potentially audit a mock transaction.

6.  *Enable Global Site Tag Verification* - (defaults to off) If checked, it
    will enable the feature to capture Global Site Tag and cookie information on
    each visited page (compatible with manual and default automatic mode) which
    will be displayed in a separate table similar to the floodlight table.

7.  *Reset Global Site Tag Per Webpage* - (defaults to off) If checked, this
    will tack on the gclid and gclsrc to each url visited in the audit to make
    sure the Global Site Tag (GST) and cookies can be set proper regardless of
    the entry point on the site. Default tool behavior will only set these
    values on the base page of the audit and test the propagation of the GST and
    cookies across the site.

8.  *Show Page with No Floodlights* - (defaults to off) If checked, tells the
    tool to add an entry in the floodlight audit table for web pages that were
    visited and where no floodlight activity was captured. If this feature is
    not activated, by default the tool will only record floodlight activity on
    pages where it occurred, leaving out pages with no floodlight activity.

9.  *Run Button* - Will trigger the audit process once it is clicked. After the
    first click, will be replaced by a Stop button which will terminate the
    audit.

10. *Download Button* - Allows the user to download the audit results as a csv
    file matching the information displayed in the UI. It will download
    Floodlight results and Global Site Tag (if enabled by user) results as
    separate CSV files. Can be clicked at any point during the audit process.

## How to Use It

1.  Navigate to the page from which you want to start, usually the websites home
    page;
2.  Open the tool by clicking the icon from the chrome toolbar;
3.  The Domain is pre-populated based on the domain on the page from which you
    started, you can change it to narrow down the pages that should be crawled;
4.  (OPTIONAL) Check “Enable Manual Mode” you wish to run the audit in manual
    mode. If checked you as the user will need to navigate through the website
    manually.
5.  (OPTIONAL) Check “Enable Global Site Tag Verification” to enable and record
    GST and cookie data during the audit.
6.  (OPTIONAL) Check “Reset Global Site Tag Per Page” if you wish for cookie
    values to be cleared after each page visit and for the gclid and gclsrc
    values to be appended to each webpage.
7.  (OPTIONAL) Check the “Show Pages with No Floodlight” in case you want the
    report to include pages that are visited but do not cause floodlight tags to
    be fired. This is particularly useful if you want to determine pages that
    are not being tracked.
8.  Click the Run button, and wait as the crawler starts to visit your site.
    Note, keep the tool popup open, if you close it by clicking anywhere on
    Chrome the process will stop, and you will only get a partial report.
9.  Once the crawling is over and the number of pages visited is the same as the
    number of pages found then the audit will be marked as completed. At this
    point you can click the Download button to export a CSV version of the final
    Floodlight and Global Site Tag report (if enabled).
