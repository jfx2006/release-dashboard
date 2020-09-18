// @flow
import './bootstrap-charming.css';
import * as React from "react";
import {
  Alert, Container, Row, Col,
  Card, CardHeader, CardLink, CardBody,
  Navbar, NavbarBrand,
  ListGroup, ListGroupItem,
  Spinner, Tooltip
} from "reactstrap";
import "./App.css";
import {connect} from "react-redux";
import type {MapStateToProps} from "react-redux";
import {
  capitalize,
  localUrlFromVersion,
  requestOngoingVersions,
  requestPollbotVersion,
  refreshStatus,
  requestStatus
} from "./actions";
import type {
  APIVersionData,
  CheckResult,
  CheckResults,
  Dispatch,
  Error,
  ProductVersions,
  Product,
  ReleaseInfo,
  State,
} from "./types";
import {products} from "./types";

const deliveryDashboardVersionData: APIVersionData = require("./version.json");

function requestNotificationPermission(): void {
  // Some browsers don't support Notification yet. I'm looking at you iOS Safari
  if ("Notification" in window) {
    if (
      Notification.permission !== "denied" &&
      Notification.permission !== "granted"
    ) {
      Notification.requestPermission();
    }
  }
}

export const parseUrl = (
  url: string
): ?{ service: string, product: Product, version: string } => {
  const re = /^#(\w+)\/(\w+)\/([^/]+)\/?/; // Eg: #pollbot/thunderbird/50.0
  const parsed: ?(string[]) = url.match(re);
  if (!parsed) {
    return null;
  }
  const [, service, product, version] = parsed;
  const maybeProduct = products.find(p => p === product);
  if (!maybeProduct) {
    // unsupported/unrecognized product.
    return null;
  }
  return {
    service: service,
    product: maybeProduct,
    version: version
  };
};

type AppProps = {
  checkResults: CheckResults,
  dispatch: Dispatch,
  pollbotVersion: APIVersionData,
  shouldRefresh: boolean,
  errors: Error[]
};

export class App extends React.Component<AppProps, void> {
  refreshIntervalId: ?IntervalID;

  constructor(props: AppProps): void {
    super(props);
    this.refreshIntervalId = null;
  }

  setUpAutoRefresh(): void {
    if (this.props.shouldRefresh) {
      if (this.refreshIntervalId) {
        // The auto-refresh is already enabled.
        return;
      }
      this.refreshIntervalId = setInterval(
        () => this.props.dispatch(refreshStatus()),
        60000
      );
    } else {
      this.stopAutoRefresh();
    }
  }

  stopAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  componentDidMount(): void {
    this.props.dispatch(requestPollbotVersion());
    this.props.dispatch(requestOngoingVersions());
    // Setup notifications.
    requestNotificationPermission();
    // Listen to url hash changes.
    window.onhashchange = this.versionFromHash;
    // Check if we have a version in the url.
    this.versionFromHash();
  }

  componentDidUpdate(): void {
    this.setUpAutoRefresh();
  }

  componentWillUnmount(): void {
    this.stopAutoRefresh();
  }

  versionFromHash = (): void => {
    const parsedUrl = parseUrl(window.location.hash);
    if (parsedUrl) {
      this.props.dispatch(requestStatus(parsedUrl.product, parsedUrl.version));
    }
  };

  render() {
    return (
      <div>
        <Errors errors={this.props.errors}/>
        <div className="main">
          <div className="sidebar">
            <SideBar/>
          </div>
          <div className="content">
            <CurrentRelease/>
          </div>
        </div>
        <footer>
          Thunderbird Release Dashboard version:{" "}
          <VersionLink versionData={deliveryDashboardVersionData}/>
          &nbsp;--&nbsp;Pollbot version:{" "}
          <VersionLink versionData={this.props.pollbotVersion}/>
        </footer>
      </div>
    );
  }
}

const connectedAppMapStateToProps: MapStateToProps<*, *, *> = (
  state: State
) => ({
  checkResults: state.checkResults,
  pollbotVersion: state.pollbotVersion,
  shouldRefresh: state.shouldRefresh,
  errors: state.errors
});
export const ConnectedApp = connect(
  connectedAppMapStateToProps,
  (dispatch: Dispatch) => ({dispatch: dispatch})
)(App);

const sideBarMapStateToProps: MapStateToProps<*, *, *> = (state: State) => ({
  versions: state.productVersions
});
const SideBar = connect(sideBarMapStateToProps)(ReleasesMenu);

type ReleasesMenuPropType = {
  versions: ProductVersions
};

export function ReleasesMenu({versions}: ReleasesMenuPropType) {
  const getVersion = (product, channel) => {
    const capitalizedChannel = capitalize(channel);
    if (versions.hasOwnProperty(product) && versions[product][channel]) {
      return (
        <ListGroupItem tag="a"
                       href={localUrlFromVersion([product, channel])}
        >{`${capitalizedChannel}: ${versions[product][channel]}`}</ListGroupItem>
      );
    } else {
      return (
        <span>
          {capitalizedChannel}: <Spinner type="grow" color="dark" />
        </span>
      );
    }
  };
  return (
    <ListGroup>
      <ListGroupItem active>Channels</ListGroupItem>
      {getVersion("thunderbird", "nightly")}
      {getVersion("thunderbird", "beta")}
      {getVersion("thunderbird", "release")}
    </ListGroup>
  );
}

const currentReleaseMapStateToProps: MapStateToProps<*, *, *> = (
  state: State
) => ({
  checkResults: state.checkResults,
  releaseInfo: state.releaseInfo,
  productVersion: state.version
});
const CurrentRelease = connect(currentReleaseMapStateToProps)(Dashboard);

type ErrorsPropType = {
  errors: Error[]
};

export function Errors({errors}: ErrorsPropType) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return (
    <div className="errors">
      {errors.map(error => {
        const [title, err] = error;
        return (
          <Alert color="danger">
            {"Failed getting check result for '" + title + "': " + err}
          </Alert>
        );
      })}
      <br/>
    </div>
  );
}

type DashboardPropType = {
  checkResults: CheckResults,
  releaseInfo: ?ReleaseInfo,
  productVersion: [Product, string]
};

export function Dashboard({
                            releaseInfo,
                            checkResults,
                            productVersion
                          }: DashboardPropType) {
  const [product, version] = productVersion;
  if (version === "") {
    return (
      <p>
        Learn more about a specific version.
        <strong> Select a version number from the left menu.</strong>
      </p>
    );
  } else if (!releaseInfo) {
    return <Spinner type="grow" color="dark" />;
  } else if (releaseInfo.message) {
    return <Errors errors={[["Pollbot error", releaseInfo.message]]}/>;
  } else {
    return (
      <Container>
        <Row>
          <Col md={"10"}>
            <h2>
              {capitalize(product)} {version}{" "}
            </h2>
          </Col>
          <Col md={"2"} style={{float: "right"}}>
            <OverallStatus
              releaseInfo={releaseInfo}
              checkResults={checkResults}
            />
          </Col>
        </Row>
        <Row>
          <div className="dashboard">
            {releaseInfo.checks.map(check => (
              <DisplayCheckResult
                key={check.title}
                title={check.title}
                actionable={check.actionable}
                checkResult={checkResults[check.title]}
              />
            ))}
          </div>
        </Row>
      </Container>
    );
  }
}

type OverallStatusPropType = {
  checkResults: CheckResults,
  releaseInfo: ReleaseInfo
};

export function OverallStatus({
                                releaseInfo,
                                checkResults
                              }: OverallStatusPropType) {
  const checksStatus = releaseInfo.checks.map(
    check => checkResults[check.title]
  );
  const allChecksCompleted = !checksStatus.some(
    result => typeof result === "undefined"
  );
  if (!allChecksCompleted) {
    return <Spinner type="grow" color="dark" />;
  }

  let actionableChecks = [];
  let nonActionableChecks = [];
  releaseInfo.checks.map(check => {
    if (check.actionable) {
      actionableChecks.push(checkResults[check.title].status);
    } else {
      nonActionableChecks.push(checkResults[check.title].status);
    }
    return check;
  });
  let type;
  let message;
  if (actionableChecks.some(status => status !== "exists")) {
    type = "danger";
    message = "Some checks failed";
  } else {
    type = "success";
    message = "All checks are successful";
  }
  return (
    <Alert color={type} message={message}>
      {message}
    </Alert>
  );
}

type DisplayCheckResultProps = {
  title: string,
  actionable: boolean,
  checkResult: CheckResult
};

export class DisplayCheckResult extends React.PureComponent<DisplayCheckResultProps,
  void> {
  render() {
    const getLabelClass = (checkResult, actionable) => {
      if (checkResult) {
        if (checkResult.status === "error") {
          return "danger";
        }
        if (checkResult.status === "exists") {
          return "success";
        }
        if (actionable) {
          return "warning";
        }
        return "info"; // It's a non actionable item.
      }
      return "info"
    };

    const {title, actionable, checkResult} = this.props;
    let titleContent = title;
    let color = getLabelClass(checkResult, actionable);
    if (!actionable) {
      titleContent = (
        <div>
          <Tooltip placement="bottom" trigger={"hover"}>
            {title}
          </Tooltip>
        </div>
      );
    }
    return (
      <Card color={color}>
        <CardHeader>{titleContent}</CardHeader>
        <CardBody style={{backgroundColor: '#fff'}}>
          {checkResult ? (
            <CardLink href={checkResult.link}>
              {checkResult.message}
            </CardLink>
          ) : (
            <Spinner type="grow" color="dark" />
          )}
        </CardBody>
      </Card>
    );
  }
}

function VersionLink({versionData}: { versionData: APIVersionData }) {
  if (!versionData) {
    return null;
  }
  const {commit, source, version} = versionData;
  const sourceUrl = source.replace(/\.git/, "");
  const url = `${sourceUrl}/commit/${commit}`;
  return <a href={url}>{version}</a>;
}

export default ConnectedApp;
