/**
 * Copyright (c) 2017, Kinvey, Inc. All rights reserved.
 *
 * This software is licensed to you under the Kinvey terms of service located at
 * http://www.kinvey.com/terms-of-use. By downloading, accessing and/or using this
 * software, you hereby accept such terms of service  (and any agreement referenced
 * therein) and agree that you have read, understand and agree to be bound by such
 * terms of service and are of legal age to agree to such terms with Kinvey.
 *
 * This software contains valuable confidential and proprietary information of
 * KINVEY, INC and is subject to applicable licensing agreements.
 * Unauthorized reproduction, transmission or distribution of this file and its
 * contents is a violation of applicable laws.
 */

const express = require('express');
const bodyParser = require('body-parser');

const config = require('config');
const { HTTPMethod } = require('./../lib/constants');
const fixtureUser = require('./fixtures/user.json');
const fixtureApps = require('./fixtures/apps.json');
const fixtureApp = require('./fixtures/app.json');
const fixtureServices = require('./fixtures/datalinks.json');
const fixtureJob = require('./fixtures/job.json');
const fixtureInternalDataLink = require('./fixtures/kinvey-dlc.json');
const fixtureLogs = require('./fixtures/logs.json');

const testsConfig = require('./tests-config');

// Authorization = `Kinvey ${user.token}`;
function isAuth(headers, expectedToken) {
  if (!headers) {
    return false;
  }

  const expectedHeaderValue = `Kinvey ${expectedToken}`;
  return headers.Authorization === expectedHeaderValue;
}

function build({ schemaVersion = testsConfig.defaultSchemaVersion, port = testsConfig.port, existentUser = fixtureUser.existent, token = fixtureUser.token, nonExistentUser = fixtureUser.nonexistent }, done) {
  const versionPart = `v${schemaVersion}`;

  const app = express();

  app.use(bodyParser.json());

  app.use(function handleAuth(req, res, next) {
    const requiresAuth = !(req.method === HTTPMethod.POST && req.url === '/session');
    if (requiresAuth) {
      const isAuth = isAuth(req.headers, token);
      if (!isAuth) {
        return res.send(401);
      }
    }

    next()
  });

  // LOGIN/LOGOUT
  app.post('/session', (req, res) => {
    if (!req.body) {
      return res.sendStatus(400);
    }

    const email = req.body.email;
    const pass = req.body.password;
    if (email === existentUser.email && pass === existentUser.password) {
      return res.send({ email: existentUser.email, token: fixtureUser.token });
    } else if (email === nonExistentUser.email && pass === nonExistentUser.password) {
      return res.send(401)
    }

    const errRes = {
      code: 'ValidationError',
      description: 'Validation failed.',
      errors: [{
        field: 'password',
        message: 'Missing required property: password'
      }]
    };

    res.status(422).send(errRes);
  });

  app.delete('/session', (req, res) => {
    return res.sendStatus(204);
  });


  // APPS
  app.get(`/${versionPart}/apps`, (req, res) => {
    console.log(req);
    console.log('______---------_______');
    res.send(fixtureApps);
  });

  app.all('/', (req, res) => {
    res.send(404);
  });

  return app.listen(port, (err) => {
    if (done) {
      console.log(err);
      console.log(`Mock server running on ${port}`);
      return done(err);
    }

    console.log(`Mock server running on ${port}`);
  });
}

//build({});


module.exports = (options, done) => {
  options = options || {};
  return build(options, done);
};







/*const nock = require('nock');

const config = require('config');
const constants = require('./../lib/constants');
const fixtureUser = require('./fixtures/user.json');
const fixtureApps = require('./fixtures/apps.json');
const fixtureApp = require('./fixtures/app.json');
const fixtureServices = require('./fixtures/datalinks.json');
const fixtureJob = require('./fixtures/job.json');
const fixtureInternalDataLink = require('./fixtures/kinvey-dlc.json');
const fixtureLogs = require('./fixtures/logs.json');

/!**
 * Mocks MAPI server. Serves as a wrapper around nock.js.
 *!/
class MockServer {
  /!**
   * @param requireAuth If true, all endpoints (except those for login) would check for user token and respond with 4xx if such is not present.
   * @param url
   * @returns {MockServer}
   *!/
  constructor(requireAuth, url = config.host) {
    this.server = nock(url);
    this.requireAuth = requireAuth;
  }

  _isAuthenticated(headers) {
    if (!this.requireAuth) {
      return true;
    }

    return headers && headers.authorization === `Kinvey ${fixtureUser.token}`;
  }

  /!**
   * Makes sure that the Auth header is properly set before replying with success.
   * @param reqHeaders
   * @param successReply
   * @returns {*}
   * @private
   *!/
  _buildReply(reqHeaders, successReply) {
    if (this._isAuthenticated(reqHeaders)) {
      return successReply;
    }

    return [
      401,
      { code: 'InvalidCredentials', description: '' }
    ];
  }

  /!**
   * Sets up the 'login' endpoint. If proper e-mail and password are provided, it will respond with 2xx.
   * @param validCredentials
   *!/
  loginWithSuccess(validCredentials = fixtureUser.existent) {
    this.server
      .post('/session', validCredentials)
      .reply(200, { email: validCredentials.email, token: fixtureUser.token });
  }

  loginWithFail(invalidCredentials = fixtureUser.nonexistent) {
    this.server
      .post('/session', invalidCredentials)
      .reply(401, { code: 'InvalidCredentials', description: '' });
  }

  loginWithTwoFactorAuthFail(validCredentials = fixtureUser.existent) {
    this.server
      .post('/session', validCredentials)
      .reply(401, { code: 'InvalidTwoFactorAuth' });
  }

  apps(apps = fixtureApps) {
    const self = this;

    this.server
      .get('/apps')
      .reply(function() {
        return self._buildReply(this.req.headers, [200, apps]);
      });
  }

  dataLinks(dataLinks = fixtureServices, id = fixtureApp.id, resourceType = 'apps', apiVersion = 'v2') {
    const self = this;
    this.server
      .get(`/${apiVersion}/${resourceType}/${id}/data-links`)
      .reply(function() {
        return self._buildReply(this.req.headers, [200, dataLinks]);
      });
  }

  /!**
   * Sets up an interceptor for the logs endpoint.
   * @param {Object|Array} query If specified, it would guarantee that a correct query is sent to the server.
   * @param logs
   * @param dataLinkId
   *!/
  logs(query, logs = fixtureLogs, dataLinkId = fixtureInternalDataLink.id) {
    const self = this;
    this.server
      .get(`/v2/data-links/${dataLinkId}/logs`)
      .query(query)
      .reply(function() {
        return self._buildReply(this.req.headers, [200, logs]);
      });
  }

  deployJob() {
    const self = this;
    this.server
      .post('/v2/jobs', (body) => {
        const isFormData = body.includes('Content-Disposition: form-data; name="file"; filename="archive.tar"\r\nContent-Type: application/tar');
        return isFormData;
      })
      .reply(function() {
        return self._buildReply(this.req.headers, [200, fixtureJob]);
      });
  }

  jobStatus(status = constants.JobStatus.COMPLETE, jobId = fixtureJob.job) {
    const self = this;
    this.server
      .get(`/v2/jobs/${jobId}`)
      .reply(function() {
        return self._buildReply(this.req.headers, [200, { status }]);
      });
  }

  recycleJob(recycledJobId = fixtureJob.job, dataLinkId = fixtureInternalDataLink.id) {
    const self = this;

    const expectedBody = {
      type: 'recycleDataLink',
      params: { dataLinkId }
    };

    this.server
      .post('/v2/jobs', expectedBody)
      .reply(function() {
        return self._buildReply(this.req.headers, [202, { job: recycledJobId }]);
      });
  }

  serviceStatus(status = constants.ServiceStatus.ONLINE, dataLinkId = fixtureInternalDataLink.id) {
    const self = this;
    this.server
      .get(`/v2/data-links/${dataLinkId}/status`)
      .reply(function() {
        return self._buildReply(this.req.headers, [200, { status }]);
      });
  }

  /!**
   * If it turns out that some of the interceptors aren't used, this might indicate a problem with the code.
   * @returns {Boolean}
   *!/
  isDone() {
    return this.server.isDone();
  }

  /!**
   * Clears absolutely all interceptors. Calling it would ensure that if a test fails to use an interceptor, other tests won't get messed up.
   *!/
  static clearAll() {
    nock.cleanAll();
  }
}

module.exports = MockServer;*/
