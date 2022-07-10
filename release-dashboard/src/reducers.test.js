import {
  ADD_CHECK_RESULT,
  ADD_SERVER_ERROR,
  REFRESH_CHECK_RESULT,
  SET_VERSION,
  UPDATE_PRODUCT_VERSIONS,
  UPDATE_POLLBOT_VERSION,
  UPDATE_RELEASE_INFO
} from "./types";
import { deliveryDashboard, initialState } from "./reducers";

const stateWith = stateCrumbs => Object.assign({}, initialState, stateCrumbs);

describe("deliveryDashboard reducer", () => {
  it("returns the initial state", () => {
    expect(deliveryDashboard(undefined, {})).toEqual(initialState);
  });
  it("handles ADD_CHECK_RESULT", () => {
    const checkResult = {
      status: "exists",
      message: "successful test",
      link: "some url"
    };
    expect(
      deliveryDashboard(undefined, {
        type: ADD_CHECK_RESULT,
        title: "some test",
        result: checkResult
      })
    ).toEqual(
      stateWith({
        checkResults: {
          "some test": checkResult
        },
        shouldRefresh: false
      })
    );

    const otherCheckResult = {
      status: "exists",
      message: "successful test",
      link: "some url"
    };
    expect(
      deliveryDashboard(
        stateWith({
          checkResults: {
            "some test": checkResult
          }
        }),
        {
          type: ADD_CHECK_RESULT,
          title: "some other test",
          result: otherCheckResult
        }
      )
    ).toEqual(
      stateWith({
        checkResults: {
          "some test": checkResult,
          "some other test": otherCheckResult
        },
        shouldRefresh: false
      })
    );

    const failingCheckResult = {
      status: "incomplete",
      message: "successful test",
      link: "some url"
    };
    expect(
      deliveryDashboard(
        stateWith({
          checkResults: {
            "some test": checkResult
          }
        }),
        {
          type: ADD_CHECK_RESULT,
          title: "some other test",
          result: failingCheckResult
        }
      )
    ).toEqual(
      stateWith({
        checkResults: {
          "some test": checkResult,
          "some other test": failingCheckResult
        },
        shouldRefresh: true
      })
    );
  });
  it("handles REFRESH_CHECK_RESULT", () => {
    const checkResult = {
      status: "exists",
      message: "successful test",
      link: "some url"
    };
    expect(
      deliveryDashboard(undefined, {
        type: REFRESH_CHECK_RESULT,
        title: "some test"
      })
    ).toEqual(
      stateWith({
        checkResults: {}
      })
    );

    const failingCheckResult = {
      status: "incomplete",
      message: "successful test",
      link: "some url"
    };
    expect(
      deliveryDashboard(
        stateWith({
          checkResults: {
            "some test": checkResult,
            "some other test": failingCheckResult
          }
        }),
        {
          type: REFRESH_CHECK_RESULT,
          title: "some other test",
          result: failingCheckResult
        }
      )
    ).toEqual(
      stateWith({
        checkResults: {
          "some test": checkResult
        }
      })
    );
  });
  it("handles ADD_SERVER_ERROR", () => {
    expect(
      deliveryDashboard(undefined, {
        type: ADD_SERVER_ERROR,
        title: "some check",
        err: "some error"
      })
    ).toEqual(
      stateWith({ errors: [["some check", "some error"]], shouldRefresh: true })
    );
    expect(
      deliveryDashboard(
        stateWith({
          errors: [["some check", "some error"]]
        }),
        {
          type: ADD_SERVER_ERROR,
          title: "some other check",
          err: "some other error"
        }
      )
    ).toEqual(
      stateWith({
        errors: [
          ["some check", "some error"],
          ["some other check", "some other error"]
        ],
        shouldRefresh: true
      })
    );
  });
  it("handles SET_VERSION", () => {
    expect(
      deliveryDashboard(undefined, {
        type: SET_VERSION,
        product: "thunderbird",
        version: "60.0"
      })
    ).toEqual(
      stateWith({ version: ["thunderbird", "60.0"], shouldRefresh: false })
    );
    expect(
      deliveryDashboard(
        stateWith({
          version: ["thunderbird", "60.0"]
        }),
        {
          type: SET_VERSION,
          product: "thunderbird",
          version: "61.0"
        }
      )
    ).toEqual(
      stateWith({ version: ["thunderbird", "61.0"], shouldRefresh: false })
    );
  });
  it("handles UPDATE_PRODUCT_VERSIONS", () => {
    expect(
      deliveryDashboard(undefined, {
        type: UPDATE_PRODUCT_VERSIONS,
        product: "thunderbird",
        versions: { release: "0.1.2" }
      })
    ).toEqual(
      stateWith({
        productVersions: {
          thunderbird: { release: "0.1.2" }
        }
      })
    );
    expect(
      deliveryDashboard(
        stateWith({
          productVersions: {
            thunderbird: { release: "0.1.2" }
          }
        }),
        {
          type: UPDATE_PRODUCT_VERSIONS,
          product: "thunderbird",
          versions: { nightly: "1.2.3", release: "0.1.3" }
        }
      )
    ).toEqual(
      stateWith({
        productVersions: {
          thunderbird: { nightly: "1.2.3", release: "0.1.3" }
        }
      })
    );
  });
  it("handles UPDATE_RELEASE_INFO", () => {
    expect(
      deliveryDashboard(undefined, {
        type: UPDATE_RELEASE_INFO,
        releaseInfo: "some new release info"
      })
    ).toEqual(stateWith({ releaseInfo: "some new release info" }));
    expect(
      deliveryDashboard(
        stateWith({
          releaseInfo: "some release info"
        }),
        {
          type: UPDATE_RELEASE_INFO,
          releaseInfo: "some new release info"
        }
      )
    ).toEqual(stateWith({ releaseInfo: "some new release info" }));
  });
  it("handles UPDATE_POLLBOT_VERSION", () => {
    expect(
      deliveryDashboard(undefined, {
        type: UPDATE_POLLBOT_VERSION,
        version: "some new pollbot version"
      })
    ).toEqual(stateWith({ pollbotVersion: "some new pollbot version" }));
    expect(
      deliveryDashboard(
        stateWith({
          pollbotVersion: "some pollbot version"
        }),
        {
          type: UPDATE_POLLBOT_VERSION,
          version: "some new pollbot version"
        }
      )
    ).toEqual(stateWith({ pollbotVersion: "some new pollbot version" }));
  });
});
