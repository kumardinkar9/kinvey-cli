/**
 * Copyright (c) 2018, Kinvey, Inc. All rights reserved.
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

const async = require('async');

const { AuthOptionsNames, CommonOptionsNames, OutputFormat } = require('./../../../../lib/Constants');
const { isEmpty } = require('./../../../../lib/Utils');
const { buildCmd, execCmdWithAssertion, setup } = require('../../../TestsHelper');

const fixtureUser = require('./../../../fixtures/user.json');
const fixtureJob = require('./../../../fixtures/job.json');

const existentUserOne = fixtureUser.existentOne;
const tokenOne = fixtureUser.tokenOne;
const nonExistentUser = fixtureUser.nonexistent;

const baseCmd = 'flex job';

function testFlexJob(profileName, optionsForCredentials, jobId, validUser, otherOptions, done) {
  const options = isEmpty(otherOptions) ? {} : otherOptions;
  if (profileName) {
    options[AuthOptionsNames.PROFILE] = profileName;
  }

  if (!isEmpty(optionsForCredentials)) {
    options[AuthOptionsNames.EMAIL] = optionsForCredentials[AuthOptionsNames.EMAIL];
    options[AuthOptionsNames.PASSWORD] = optionsForCredentials[AuthOptionsNames.PASSWORD];
  }

  const apiOptions = {};
  if (!isEmpty(validUser)) {
    apiOptions.token = validUser.token;
    apiOptions.existentUser = { email: validUser.email };
  }

  const positionalArgs = [];
  if (jobId) {
    positionalArgs.push(jobId);
  }

  const cmd = buildCmd(baseCmd, positionalArgs, options, [CommonOptionsNames.VERBOSE]);
  execCmdWithAssertion(cmd, null, apiOptions, true, true, false, null, done);
}

describe(baseCmd, () => {
  const defaultJobId = fixtureJob.job;
  const nonExistentJobId = '123jobDoesntExist';

  const validUserForGettingStatus = {
    email: existentUserOne.email,
    token: tokenOne
  };

  before((done) => {
    async.series([
      (next) => {
        setup.clearGlobalSetup(null, next);
      },
      (next) => {
        setup.createProfiles('flexJobProfile', next);
      }
    ], done);
  });

  after((done) => {
    setup.clearAllSetup(done);
  });

  describe('by specifying a profile', () => {
    const profileToUse = 'profileToGetJobStatus';

    before((done) => {
      setup.createProfile(profileToUse, existentUserOne.email, existentUserOne.password, done);
    });

    after((done) => {
      setup.deleteProfileFromSetup(profileToUse, null, done);
    });

    it('and existent jobId should succeed and output default format', (done) => {
      testFlexJob(profileToUse, null, defaultJobId, validUserForGettingStatus, null, done);
    });

    it('and existent jobId should succeed and output JSON', (done) => {
      testFlexJob(profileToUse, null, defaultJobId, validUserForGettingStatus, { [CommonOptionsNames.OUTPUT]: OutputFormat.JSON }, done);
    });

    it('and non-existent jobId should fail', (done) => {
      testFlexJob(profileToUse, null, nonExistentJobId, validUserForGettingStatus, null, done);
    });
  });

  describe('by not specifying profile nor credentials', () => {
    it('when one profile and existent jobId should succeed', (done) => {
      testFlexJob(null, null, defaultJobId, null, null, done);
    });
  });

  describe('by not specifying profile nor credentials when several profiles', () => {
    const oneMoreProfile = 'oneMoreProfile';
    before((done) => {
      setup.createProfile(oneMoreProfile, existentUserOne.email, existentUserOne.password, done);
    });

    after((done) => {
      setup.deleteProfileFromSetup(oneMoreProfile, null, done);
    });

    it('and existent jobId should fail', (done) => {
      const cmd = `${baseCmd} ${defaultJobId}`;
      execCmdWithAssertion(cmd, null, null, true, false, true, null, (err) => {
        expect(err).to.not.exist;
        done();
      });
    });
  });

  describe('by specifying credentials as options', () => {
    it('when valid and existent jobId should succeed', (done) => {
      testFlexJob(null, existentUserOne, defaultJobId, validUserForGettingStatus, null, done);
    });

    it('when valid and non-existent jobId should fail', (done) => {
      testFlexJob(null, existentUserOne, nonExistentJobId, validUserForGettingStatus, null, done);
    });

    it('when invalid and existent jobId should fail', (done) => {
      testFlexJob(null, nonExistentUser, defaultJobId, validUserForGettingStatus, null, done);
    });
  });

  describe('without additional args and options when active profile is set', () => {
    const activeProfile = 'willBeActive';
    before('setActiveProfile', (done) => {
      setup.setActiveProfile(activeProfile, true, done);
    });

    before('setProjectSetup', (done) => {
      const projectSetupKeyValues = [
        {
          key: activeProfile,
          value: {
            jobId: defaultJobId
          }
        },
        {
          key: 'shallNotBeUsed',
          value: {
            jobId: nonExistentJobId
          }
        }
      ];

      async.eachSeries(
        projectSetupKeyValues,
        (item, next) => {
          setup.createProjectSetup(item.key, item.value, next);
        },
        done
      );
    });

    it('should suceed', (done) => {
      testFlexJob(null, null, null, null, null, done);
    });
  });
});
