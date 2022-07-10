/* Functional tests of the Pollbot API */

import {enableFetchMocks} from 'jest-fetch-mock'

enableFetchMocks()

import {
  checkStatus,
  getPollbotVersion,
  getOngoingVersions,
  getReleaseInfo
} from "./PollbotAPI";

describe("getOngoingVersions", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  it("retrieves the list of ongoing versions", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({release: "78.2.2", beta: "81.0b3", nightly: "82.0a1"}))

    const channelVersions = await getOngoingVersions("thunderbird");
    expect(channelVersions).toMatchObject({
      nightly: expect.any(String),
      beta: expect.any(String),
      release: expect.any(String)
    });
  });
});

describe("getReleaseInfo", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  it("retrieves the release information for thunderbird", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      "product": "thunderbird",
      "version": "60.0",
      "channel": "release",
      "checks": [{
        "title": "Archive Release",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/archive",
        "actionable": true
      }, {
        "title": "Balrog update rules",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/balrog-rules",
        "actionable": true
      }, {
        "title": "Bouncer",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/bouncer",
        "actionable": true
      }, {
        "title": "Buildhub release info",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/buildhub",
        "actionable": true
      }, {
        "title": "Download links",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/bedrock/download-links",
        "actionable": true
      }, {
        "title": "Product details",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/product-details",
        "actionable": true
      }, {
        "title": "Release notes",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/bedrock/release-notes",
        "actionable": true
      }, {
        "title": "Security advisories",
        "url": "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/bedrock/security-advisories",
        "actionable": true
      }]
    }))

    const releaseInfo = await getReleaseInfo("thunderbird", "60.0");
    expect(releaseInfo).toMatchObject({
      channel: expect.stringMatching(/nightly|beta|release/),
      checks: expect.any(Array),
      product: "thunderbird",
      version: "60.0"
    });
    releaseInfo.checks.map(check => {
      expect(check).toMatchObject({
        title: expect.any(String),
        url: expect.any(String)
      });
    });
  });
});

describe("checkStatus", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  it("retrieves the status of a given check", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      "status": "exists",
      "message": "We found product-details information about version 60.0",
      "link": "https://product-details.mozilla.org/1.0/thunderbird.json"
    }))

    const status = await checkStatus(
      "https://pollbot.stage.mozaws.net/v1/thunderbird/60.0/product-details"
    );
    expect(status).toEqual({
      link: "https://product-details.mozilla.org/1.0/thunderbird.json",
      status: "exists",
      message: "We found product-details information about version 60.0"
    });
  });
});

describe("getPollbotVersion", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  it("retrieves the version from Pollbot", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({
      "commit": "78539afa363b200ef004f40531665826f234eab3",
      "version": "1.4.3",
      "source": "https://github.com/mozilla/PollBot",
      "build": "https://circleci.com/gh/mozilla/PollBot/722"
    }))

    const version = await getPollbotVersion();
    expect(version).toMatchObject({
      commit: expect.any(String),
      build: expect.any(String),
      source: expect.any(String),
      version: expect.any(String)
    });
  });
});
