import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { mount, shallow } from "enzyme";
import {
  App,
  ConnectedApp,
  Dashboard,
  DisplayCheckResult,
  Errors,
  OverallStatus,
  ReleasesMenu,
  parseUrl
} from "./App";
import { Alert, Spinner, Tooltip } from "reactstrap";
import createStore from "./create-store";
import { pollbotUrl } from "./index";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

// Mock the Notification API.
global.Notification = {
  requestPermission: jest.fn()
};

// Mock the localStorage API.
global.localStorage = (function() {
  var store = {};

  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    }
  };
})();

// Mock the Pollbot version (version won't be visible in the rendered
// component, as it's only visible after the state has been updated, not on
// first render.
function fetchMocker(response) {
  return jest
    .fn()
    .mockImplementation(() => Promise.resolve({ json: () => response }));
}

global.fetch = fetchMocker({
  version: "pollbot-version-number",
  commit: "pollbot-commit-hash",
  source: "https://github.com/mozilla/PollBot.git",
  name: "pollbot"
});

// Mock the delivery-dashboard version
jest.mock("./version", () => ({
  version: "version-number",
  commit: "commit-hash",
  source: "https://github.com/mozilla/delivery-dashboard.git",
  name: "delivery-dashboard"
}));

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.clearAllTimers();
});

describe("<App />", () => {
  it("renders without crashing", () => {
    const app = renderer.create(
      <Provider store={createStore()}>
        <ConnectedApp />
      </Provider>
    );
    expect(app.toJSON()).toMatchSnapshot();
  });
  it("requests for Notification permissions", () => {
    renderer.create(
      <Provider store={createStore()}>
        <ConnectedApp />
      </Provider>
    );
    expect(global.Notification.requestPermission).toHaveBeenCalled();
  });
  it("requests PollBot for its version", () => {
    renderer.create(
      <Provider store={createStore()}>
        <ConnectedApp />
      </Provider>
    );
    expect(global.fetch).toHaveBeenCalledWith(`${pollbotUrl}/__version__`);
  });
  it("calls requestStatus(version) with the version from the hash", () => {
    global.window.location.hash = "#pollbot/thunderbird/123.0";

    const module = require("./actions");
    module.requestStatus = jest.fn();

    const store = createStore();
    // We also need to mock the dispatch function, as it doesn't like to be
    // called with a mock.
    store.dispatch = jest.fn();

    renderer.create(
      <Provider store={store}>
        <ConnectedApp />
      </Provider>
    );
    expect(module.requestStatus).toHaveBeenCalledWith("thunderbird", "123.0");
  });
  it("sets up auto-refresh", () => {
    const module = require("./actions");
    module.requestStatus = jest.fn();
    module.refreshStatus = jest.fn();

    const wrapper = shallow(<App dispatch={jest.fn()} />);
    const app = wrapper.instance();
    app.stopAutoRefresh = jest.fn();

    // Called once, on mounting the component.
    jest.runOnlyPendingTimers();
    const numCalledRequestStatus = module.requestStatus.mock.calls.length;

    // Shouldn't auto-refresh => stop auto refresh.
    expect(app.stopAutoRefresh).toHaveBeenCalledTimes(0);
    wrapper.setProps({ shouldRefresh: false });
    expect(app.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(app.refreshIntervalId).toBeNull();
    app.setUpAutoRefresh();
    expect(app.stopAutoRefresh).toHaveBeenCalledTimes(2);
    expect(app.refreshIntervalId).toBeNull();
    jest.runOnlyPendingTimers();
    expect(module.requestStatus).toHaveBeenCalledTimes(numCalledRequestStatus);
    expect(module.refreshStatus).toHaveBeenCalledTimes(0);

    // Should auto-refresh => start auto refresh.
    expect(app.refreshIntervalId).toBeNull();
    wrapper.setProps({ shouldRefresh: true });
    app.setUpAutoRefresh();
    expect(app.stopAutoRefresh).toHaveBeenCalledTimes(2); // Not called again.
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(app.refreshIntervalId).toBeTruthy();
    jest.runOnlyPendingTimers();
    expect(module.requestStatus).toHaveBeenCalledTimes(numCalledRequestStatus);
    expect(module.refreshStatus).toHaveBeenCalledTimes(1);

    // Should auto-refresh, but already set up => don't start auto refresh.
    wrapper.setProps({ shouldRefresh: true });
    app.setUpAutoRefresh();
    expect(app.stopAutoRefresh).toHaveBeenCalledTimes(2); // Not called again.
    expect(setInterval).toHaveBeenCalledTimes(1); // Not called again.
    expect(app.refreshIntervalId).toBeTruthy();
    expect(module.requestStatus).toHaveBeenCalledTimes(numCalledRequestStatus);
    expect(module.refreshStatus).toHaveBeenCalledTimes(1); // Not called again.
  });
  it("stops auto-refresh", () => {
    const app = shallow(<App dispatch={jest.fn()} />).instance();

    // Shouldn't call clearInterval if not needed.
    expect(app.refreshIntervalId).toBeNull();
    app.stopAutoRefresh();
    expect(clearInterval).toHaveBeenCalledTimes(0);
    // Should call clearInterval if needed.
    app.refreshIntervalId = 123;
    app.stopAutoRefresh();
    expect(clearInterval).toHaveBeenCalledWith(123);
    expect(app.refreshIntervalId).toBeNull();
  });
  it("stops the auto-refresh on unmount", () => {
    const wrapper = shallow(<App dispatch={jest.fn()} />);
    const app = wrapper.instance();
    app.stopAutoRefresh = jest.fn();
    wrapper.unmount();
    expect(app.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("parseUrl", () => {
  it("returns null for a non matching url", () => {
    expect(parseUrl("")).toBeNull();
    expect(parseUrl("#foobar")).toBeNull();
  });
  it("returns null if the product isn't recognized", () => {
    expect(parseUrl("#pollbot/foobar/50.0")).toBeNull();
  });
  it("returns the proper structure for a matching url", () => {
    expect(parseUrl("#pollbot/thunderbird/60.0")).toEqual({
      service: "pollbot",
      product: "thunderbird",
      version: "60.0"
    });
  });
});

describe("<ReleasesMenu />", () => {
  it("displays a list of channels with spinners if there's no product versions yet", () => {
    const wrapper = mount(<ReleasesMenu versions={{}} />);
    const textContent = wrapper.text();
    expect(textContent).toContain("Nightly");
    expect(textContent).toContain("Beta");
    expect(textContent).toContain("Release");
  });
  it("displays a list of channels with version numbers if there's product versions", () => {
    const wrapper = mount(
      <ReleasesMenu
        versions={{
          thunderbird: {
            nightly: "82.0a1",
            beta: "81.0b4",
            release: "78.2.1"
          }
        }}
      />
    );
    const textContent = wrapper.text();
    expect(textContent).toContain("Nightly: 82.0a1");
    expect(textContent).toContain("Beta: 81.0b4");
    expect(textContent).toContain("Release: 78.2.1");
  });
});

describe("<Errors />", () => {
  it("displays a list of errors", () => {
    const wrapper = mount(<Errors errors={[["foo", "bar"]]} />);
    expect(wrapper.text()).toContain(
      "Failed getting check result for 'foo': bar"
    );
  });
  it("doesn't return anything if there's no errors", () => {
    const wrapper = mount(<Errors errors={[]} />);
    expect(wrapper.instance()).toBeNull();
  });
});

describe("<Dashboard />", () => {
  const releaseInfo = {
    channel: "nightly",
    product: "thunderbird",
    version: "60.0",
    checks: [
      { url: "some-url", title: "some title", actionable: true },
      { url: "some-url-2", title: "some title 2", actionable: false }
    ]
  };
  const checkResults = {
    "some title": {
      status: "exists",
      message: "check is successful",
      link: "some link"
    },
    "some title 2": {
      status: "exists",
      message: "check is successful",
      link: "some link"
    }
  };
  it("displays a help text when no version is selected", () => {
    const wrapper = shallow(<Dashboard productVersion={["thunderbird", ""]} />);
    expect(wrapper.text()).toContain(
      "Learn more about a specific version. Select a version number from the left menu."
    );
  });
  it("displays a spinner when a version is selected", () => {
    const wrapper = shallow(
      <Dashboard productVersion={["thunderbird", "60.0"]} />
    );
    expect(wrapper.find("Spinner").length).toBe(1);
  });
  it("displays an error when there's a Pollbot error", () => {
    const wrapper = mount(
      <Dashboard
        productVersion={["thunderbird", "60.0"]}
        releaseInfo={{ message: "error from pollbot" }}
      />
    );
    const error = wrapper.find(Errors);
    expect(error.length).toBe(1);
    expect(error.text()).toEqual(
      "Failed getting check result for 'Pollbot error': error from pollbot"
    );
  });
  it("displays a list of check results when a release info is present", () => {
    const wrapper = shallow(
      <Dashboard
        productVersion={["thunderbird", "60.0"]}
        releaseInfo={releaseInfo}
        checkResults={checkResults}
      />
    );
    // expect(wrapper.find("Spinner").length).toBe(0);
    expect(wrapper.find("DisplayCheckResult").length).toBe(2);
  });
  /* it("displays a tooltip on the checks that aren't actionable", () => {
    const wrapper = mount(
      <Dashboard
        productVersion={["thunderbird", "60.0"]}
        releaseInfo={releaseInfo}
        checkResults={checkResults}
      />
    );
    const tooltip = wrapper.find("Tooltip");
    expect(tooltip.placement).toBe("bottom");
    expect(tooltip.trigger).toEqual("hover");
  }); */
});

describe("<OverallStatus />", () => {
  const releaseInfo = {
    channel: "nightly",
    product: "thunderbird",
    version: "60.0",
    checks: [
      { url: "some-url", title: "some title", actionable: true },
      { url: "some-url-2", title: "some title 2", actionable: false }
    ]
  };
  const incompleteCheckResults = {
    "some title": {
      status: "exists",
      message: "check is successful",
      link: "some link"
    }
  };
  const checkResults = {
    "some title": {
      status: "exists",
      message: "check is successful",
      link: "some link"
    },
    "some title 2": {
      status: "exists",
      message: "check is successful",
      link: "some link"
    }
  };
  it('displays a "success" label when all the results are successful', () => {
    const wrapper = mount(
      <OverallStatus releaseInfo={releaseInfo} checkResults={checkResults} />
    );
    const status = wrapper.find(Alert);
    expect(status.prop("message")).toEqual("All checks are successful");
    expect(status.prop("color")).toEqual("success");
  });
  it('displays an "success" label if some non actionable check results are unsuccessful', () => {
    const results = Object.assign({}, checkResults, {
      "some title 2": Object.assign({}, checkResults["some title 2"], {
        status: "missing"
      })
    });
    const wrapper = mount(
      <OverallStatus releaseInfo={releaseInfo} checkResults={results} />
    );
    const status = wrapper.find(Alert);
    expect(status.prop("message")).toEqual("All checks are successful");
    expect(status.prop("color")).toEqual("success");
  });
  it('displays an "error" label if some actionable check results are unsuccessful', () => {
    const results = Object.assign({}, checkResults, {
      "some title": Object.assign({}, checkResults["some title"], {
        status: "missing"
      })
    });
    const wrapper = mount(
      <OverallStatus releaseInfo={releaseInfo} checkResults={results} />
    );
    const status = wrapper.find(Alert);
    expect(status.prop("message")).toEqual("Some checks failed");
    expect(status.prop("color")).toEqual("danger");
  });
  it('displays an "error" label if some actionable check results are errored', () => {
    const results = Object.assign({}, checkResults, {
      "some title": Object.assign({}, checkResults["some title"], {
        status: "error"
      })
    });
    const wrapper = mount(
      <OverallStatus releaseInfo={releaseInfo} checkResults={results} />
    );
    const status = wrapper.find(Alert);
    expect(status.prop("message")).toEqual("Some checks failed");
    expect(status.prop("color")).toEqual("danger");
  });
  it("displays a spinner for the overall status until all the checks results are received", () => {
    const wrapper = shallow(
      <OverallStatus
        releaseInfo={releaseInfo}
        checkResults={incompleteCheckResults}
      />
    );
    expect(wrapper.find("Spinner").length).toBe(1);
  });
});

/* describe("<DisplayStatus />", () => {
  const checkDisplayStatus = (status, actionable, label) => {
    const wrapper = mount(
      <DisplayStatus
        status={status}
        actionable={actionable}
        message="check message"
        url="check url"
      />
    );
    const link = wrapper.find("a");
    expect(link.prop("href")).toEqual("check url");
    expect(link.prop("title")).toEqual("check message");
    const alert = wrapper.find(Alert);
    expect(alert.prop("type")).toBe(label);
    expect(link.text()).toEqual("check message");
  };
  it("displays the status when the status is exists", () => {
    checkDisplayStatus("exists", true, "success");
  });
  it("displays the status when the status is incomplete", () => {
    checkDisplayStatus("incomplete", true, "warning");
  });
  it("displays the status when the status is missing", () => {
    checkDisplayStatus("missing", true, "warning");
  });
  it("displays the error message when there an error", () => {
    checkDisplayStatus("error", true, "error");
  });
  it("displays the status when the status is exists and the item is not actionable", () => {
    checkDisplayStatus("exists", false, "success");
  });
  it("displays the status when the status is incomplete and the item is not actionable", () => {
    checkDisplayStatus("incomplete", false, "info");
  });
  it("displays the status when the status is missing and the item is not actionable", () => {
    checkDisplayStatus("missing", false, "info");
  });
  it("displays the error message when there an error and the item is not actionable", () => {
    checkDisplayStatus("error", false, "error");
  });
});
*/