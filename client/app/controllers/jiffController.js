define(['mpc', 'pki', 'BigNumber', 'jiff', 'jiff_bignumber', 'jiff_client_restful', 'table_template'], function (mpc, pki, BigNumber, JIFFClient, jiff_bignumber, jiff_client_restful, table_template) {

  var cryptoHooks = {
    encryptSign: function (jiff, message, receiver_public_key) {
      // Analyst never encrypts anything
      if (jiff.id === 1) {
        return message;
      }

      // Submitters only encrypt analyst share
      if (receiver_public_key == null || receiver_public_key === '' || receiver_public_key === 's1') {
        return message;
      }

      return pki.encrypt(message, receiver_public_key);
    },
    decryptSign: function (jiff, cipher, secret_key, sender_public_key) {
      // Submitters never decrypt anything
      if (jiff.id !== 1) {
        return cipher;
      }

      // Analyst only decrypts shares from submitters
      if (sender_public_key === 's1') {
        // Do not decrypt messages from the server
        return cipher;
      }

      return pki.decrypt(cipher, secret_key);
    },
    parseKey: function (jiff, keyString) {
      // We really parse just one key, the analyst key
      if (keyString == null || keyString === '' || keyString === 's1') {
        return keyString;
      }

      return pki.parsePublicKey(keyString);
    },
    dumpKey: function (jiff, key) {
      // No one cares about the submitters keys, dump the empty defaults
      if (jiff.id !== 1) {
        return key;
      }

      // Analyst public key will never be dumped except by the analyst
      // do not return anything (undefined) so that the public key
      // is never modified.
    }
  };

  // initialize jiff instance
  var initialize = function (session, role, options) {
    var baseOptions = {
      autoConnect: false,
      sodium: false,
      hooks: {
        createSecretShare: [function (jiff, share) {
          share.refresh = function () {
            return share;
          };
          return share;
        }]
      },
      public_keys: {
        s1: 's1'
      }
    };
    baseOptions = Object.assign(baseOptions, options);
    baseOptions.hooks = Object.assign({}, baseOptions.hooks, cryptoHooks);
    var bigNumberOptions = {
      Zp: '618970019642690137449562111', // Must be set to a prime number! Currently 2^89-1
      safemod: false
    };

    var restOptions = {
      flushInterval: 0,
      pollInterval: 0,
      maxBatchSize: 5000
    };
    if (role === 'analyst') {
      restOptions['flushInterval'] = 6000; // 6 seconds
    }

    var port = window.location.port === '8080' ? ':8080' : '';
    var instance = new JIFFClient(window.location.protocol + '//' + window.location.hostname + port, session, baseOptions);
    instance.apply_extension(jiff_bignumber, bigNumberOptions);
    instance.apply_extension(jiff_client_restful, restOptions);

    instance.connect();
    return instance;
  };

  // Client side stuff
  var clientSubmit = function (sessionkey, userkey, dataSubmission, callback, cohort) {
    var ordering = mpc.consistentOrdering(table_template);
    var values = [];

    // List values according to consistent ordering
    for (var i = 0; i < ordering.tables.length; i++) {
      var t = ordering.tables[i];
      values.push(Math.round(dataSubmission[t.table][t.row][t.col]));
    }
    for (var j = 0; j < ordering.questions.length; j++) {
      var q = ordering.questions[j];
      values.push(dataSubmission['questions'][q.question][q.option]);
    }

    for (var k = 0; k < ordering.usability.length; k++) {
      var m = ordering.usability[k].metric;
      var f = ordering.usability[k].field;

      if (f != null && f !== '') {
        values.push(dataSubmission.usability[m][f]);
      } else {
        values.push(dataSubmission.usability[m]);
      }
    }

    // Handle jiff errors returned from server
    var options = {
      onError: function (errorString) {
        callback(null, JSON.stringify({ status: false, error: errorString }));
      },
      initialization: {
        userkey: userkey,
        cohort: cohort,
      },
      party_id: null
    };

    // Initialize and submit
    var jiff = initialize(sessionkey, 'client', options);
    jiff.wait_for([1, 's1'], function () {
      // After initialization
      jiff.restReceive = function () {
        jiff.disconnect(false, false);
        callback.apply(null, arguments);
      };
      // first share table values
      for (var i = 0; i < ordering.tables.length; i++) {
        jiff.share(values[i], null, [1, 's1'], [jiff.id]);
      }
      // then share table values squared (for deviations)
      for (i = 0; i < ordering.tables.length; i++) {
        jiff.share(new BigNumber(values[i]).pow(2), null, [1, 's1'], [jiff.id]);
      }
      // then share the product of the independent and dependent variables for linear regression


      //have a data structure that stores the product of all the pairs for all the tables
      //each table has a hashtable where the key is the row, col pair as a string and the value is the product
      products = {};

      //loop through all the pairs for linear regression, every time you find half of the pair, check to see
      //if you already found the other half of the pair, if so multiply the first value by the second value, 
      //otherwise create the key value pair, the key being the pair and the value being the the value of 
      // half of the pair
      for(i = 0; i < ordering.tables.length; i++){
        var op = ordering.tables[i].op;
        if(op['LIN'] != null){
          op['LIN'].forEach(function(pair) {
            if ((ordering.tables[i].row == pair[0][0] && ordering.tables[i].col == pair[0][1]) ||
                (ordering.tables[i].row == pair[1][0] && ordering.tables[i].col == pair[1][1])){
                  
                  if (products[ordering.tables[i].table] == null){
                    products[ordering.tables[i].table] = {};
                  }
                    if (products[ordering.tables[i].table][pair.toString()] == null){
                        products[ordering.tables[i].table][pair.toString()] = values[i];
                    } else{
                      products[ordering.tables[i].table][pair.toString()] *= values[i];
                    }
                }
          })
        }
        
      }

      //loop through the products as share them
      for (var table in products){
        for(var pair in products[table]){
          jiff.share(products[table][pair], null, [1, 's1'], [jiff.id]);
        }
      }


      // then share the rest
      for (i = ordering.tables.length; i < values.length; i++) {
        jiff.share(values[i], null, [1, 's1'], [jiff.id]);
      }
      jiff.restFlush();
    });
  };

  // Analyst side stuff
  var computeAndFormat = function (sessionkey, password, secretkey, progressBar, error, callback) {
    var options = {
      onError: error,
      secret_key: pki.parsePrivateKey(secretkey),
      party_id: 1,
      initialization: {
        password: password
      }
    };

    // Initialize
    var jiff = initialize(sessionkey, 'analyst', options);
    // Listen to the submitter ids from server
    jiff.listen('compute', function (party_id, msg) {
      jiff.remove_listener('compute');

      if (party_id !== 's1') {
        return;
      }

      // Meta-info
      var ordering = mpc.consistentOrdering(table_template);
      var submitters = JSON.parse(msg);

      // Compute and Format
      var promise = mpc.compute(jiff, submitters, ordering, progressBar);
      promise.then(function (result) {
        jiff.disconnect(false, false);
        callback(mpc.format(result, submitters, ordering));
      }).catch(function (err) {
        error(err.toString());
      });
    });
  };

  // Exports
  return {
    client: {
      submit: clientSubmit
    },
    analyst: {
      computeAndFormat: computeAndFormat
    }
  }
});
