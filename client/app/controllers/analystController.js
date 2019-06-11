/***************************************************************
 *
 * Interface for generating session key and initiating a new
 * session.
 *
 */
/* global saveAs, Uint8Array */

define(['filesaver', 'pki'], function (filesaver, pki) {

  'use strict';

  function addCohort(session, password, cohort) {
    return $.ajax({
      type: 'POST',
      url: '/add_cohort',
      contentType: 'application/json',
      data: JSON.stringify({session: session, password: password, cohort: cohort})
    }).then(function (res) {
      return res;
    }).catch(function (err) {
      if (err && err.hasOwnProperty('responseText') && err.responseText !== undefined) {
        alert(err.responseText);
      }
    });
  }

  function checkStatus(session, password) {
    if (!session || session.trim() === '' || !password) {
      return $.Deferred().reject();
    }

    return $.ajax({
      type: 'POST',
      url: '/fetch_status',
      contentType: 'application/json',
      data: JSON.stringify({session: session})
    }).then(function (resp) {
      return resp;
    }).catch(function (err) {
      throw new Error(err.responseText);
    });
  }

  function changeStatus(session, password, status) {
    if (status === 'START' || status === 'PAUSE' || status === 'STOP') {
      return $.ajax({
        type: 'POST',
        url: '/change_status',
        contentType: 'application/json',
        data: JSON.stringify({status: status, session: session, password: password})
      }).then(function (resp) {
        return resp.result;
      }).catch(function (err) {
        if (err && err.hasOwnProperty('responseText') && err.responseText !== undefined) {
          alert(err.responseText);
        }
      });
    } else {
      alert('Error Not a valid Session Status');
    }
  }

  function formatUrls(urls) {
    var resultUrls = {};

    for (var cohort in urls) {
      const cohortUrls = urls[cohort];
      var port = window.location.port ? ':' + window.location.port : '';
      var baseUrl = window.location.protocol + '//' + window.location.hostname + port;

      resultUrls[cohort] = [];
      for (var i = 0; i < cohortUrls.length; i++) {
        resultUrls[cohort].push(baseUrl + cohortUrls[i]);
      }
    }
    return resultUrls;
  }

  function generateNewParticipationCodes(session, password, count, cohort) {
    return $.ajax({
      type: 'POST',
      url: '/generate_client_urls',
      contentType: 'application/json',
      data: JSON.stringify({cohort: cohort, count: count, session: session, password: password})
    })
      .then(function (res) {
        const urls = {};
        urls[res.cohort] = res.result;
        return formatUrls(urls);
      })
      .catch(function (err) {
        if (err && err.hasOwnProperty('responseText') && err.responseText !== undefined) {
          alert(err.responseText);
        }
      });
  }

  function getExistingCohorts(session, password) {
    return $.ajax({
      type: 'POST',
      url: '/get_cohorts_manage',
      contentType: 'application/json',
      data: JSON.stringify({session: session, password: password})
    }).then(function (resp) {
      return resp.cohorts;
    }).catch(function (err) {
      if (err && err.hasOwnProperty('responseText') && err.responseText !== undefined) {
        alert(err.responseText);
      }
    });
  }

  function getExistingParticipants(session, password) {
    return $.ajax({
      type: 'POST',
      url: '/get_client_urls',
      contentType: 'application/json',
      data: JSON.stringify({session: session, password: password})
    })
      .then(function (resp) {
        return formatUrls(resp.result);
      })
      .catch(function (err) {
        throw new Error(err.responseText);
      });
  }

  function generateSession(hiddenDiv, sessionID, passwordID, pubID, privID, linkID, titleID, descriptionID) {
    var title = document.getElementById(titleID).value;
    var description = document.getElementById(descriptionID).value;

    if (title == null || description == null || title === '' || description === '') {
      alert('Session title and description are required');
      return null;
    }

    return pki.generateKeyPair().then(function (result) {
      var privateKey = result.privateKey;
      var publicKey = result.publicKey;

      var priBlob = new Blob([privateKey], {type: 'text/plain;charset=utf-8'});

      return $.ajax({
        type: 'POST',
        url: '/create_session',
        contentType: 'application/json',
        data: JSON.stringify({publickey: publicKey, title: title, description: description})
      })
      .then(function (resp) {
        var rndSess = resp.sessionID;
        var password = resp.password;
        document.getElementById(privID).innerHTML = privateKey;
        document.getElementById(pubID).innerHTML = publicKey;
        document.getElementById(sessionID).innerHTML = rndSess;
        document.getElementById(passwordID).innerHTML = password;
        // TODO clean up how this workflow
        document.getElementById(linkID).innerHTML = 'manage page';
        document.getElementById(linkID).href = '/manage?session=' + rndSess;

        filesaver.saveAs(priBlob, 'Session_' + rndSess + '_private_key.pem');

        var text = 'Session Key:\n' + rndSess + '\nPassword:\n' + password;
        filesaver.saveAs(new Blob([text], {type: 'text/plain;charset=utf-8'}), 'Session_' + rndSess + '_password.txt');
      })
      .catch(function () {
        var errmsg = 'ERROR!!!: failed to load public key to server, please try again';
        document.getElementById(sessionID).innerHTML = errmsg;
        document.getElementById(privID).innerHTML = errmsg;
        document.getElementById(pubID).innerHTML = errmsg;
        document.getElementById(passwordID).innerHTML = errmsg;
      });
    }).catch(function () {
      var errmsg = 'ERROR!!!: failed to load public key to server, please try again';
      document.getElementById(sessionID).innerHTML = errmsg;
      document.getElementById(privID).innerHTML = errmsg;
      document.getElementById(pubID).innerHTML = errmsg;
    });
  }

  function getSubmissionHistory(session, password, timestamp) {
    return $.ajax({
      type: 'POST',
      url: '/get_history',
      contentType: 'application/json',
      data: JSON.stringify({session: session, password: password, last_fetch: timestamp}),
    })
    .then(function (res) {
      return res;
    })
    .catch(function (err) {
      if (err && err.hasOwnProperty('responseText') && err.responseText !== undefined) {
        alert(err.responseText);
      }
    });
  }

  function getParameterByName(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
      results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }

  return {
    checkStatus: checkStatus,
    changeStatus: changeStatus,
    generateNewParticipationCodes: generateNewParticipationCodes,
    getExistingParticipants: getExistingParticipants,
    getExistingCohorts: getExistingCohorts,
    getSubmissionHistory: getSubmissionHistory,
    generateSession: generateSession,
    getParameterByName: getParameterByName,
    addCohort: addCohort,
    START: 'START',
    PAUSE: 'PAUSE',
    STOP: 'STOP'
  };
});
