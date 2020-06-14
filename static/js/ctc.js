var PERTS = (function () {
    'use strict';

    // ** Constants ** //

    var separator = '\t',  // what separates fields in a row
        saltRegex = /^\S{20,40}$/,  // 20-40 characters, no white space
        tokenRegex = /^\S{3,}$/,  // at least 3 characters, no white space
        emailRegex = /^.+@.+$/,   // @ with something before and after
        tokenColumnName = 'plaintext_token',
        tokenColumnRename = 'token',
        maximumRows = Math.pow(10, 6),
        panelRequiredColumns = ['link', 'link_expiration', 'token'],
        trailingLinesWarning = " May also be caused by empty rows at the " +
            "end of the data.";

    // ** Initialization ** //

    var alert = false,      // true if an alert is active
        alertMessages = {}, // messages to show to the user
        salt,
        tokenIndex,         // which column holds the token
        mapTextarea,        // DOM node for "Email-Token Map"
        listTextarea,       // DOM node for "Token List"
        mapRows,            // map data rows (w/o column headers)
        mapColumns,         // map column names (header fields)
        emailColumnIndex,   // 0 or 1, if email column is 1st or 2nd
        tokenColumnIndex,   // 0 or 1, if token column is 1st or 2nd
        knownTokens,        // "Token List" data
        mapIndex,           // token -> email hash object
        mapTokens,
        mapEmails,
        cohortIndex = {};   // index of cohort codes and anon links

    // ** Shared functions ** //

    // The native .test() method allows non-string values to be coerced to
    // strings (e.g. undefined becomes "undefined") and THEN compared to the
    // regex. That's dumb. If it's not a string, it shouldn't match the regex,
    // period. This accomplishes that.
    RegExp.prototype.testString = function (value) {
        if (typeof value === 'string') {
            return this.test(value);
        } else {
            return false;
        }
    };

    var UserInputError = function (message) {
        this.message = message;
    };
    UserInputError.prototype = new Error();
    UserInputError.prototype.constructor = Error;

    var displayAlert = function (type, message) {
        // 'invalid' is just like 'danger' except it also throws an error.
        var shouldThrow = false;
        if (type === 'invalid') {
            type = 'danger';
            shouldThrow = true;
        }

        alert = true;
        util.initProp(alertMessages, type, []);
        alertMessages[type].push(message);

        var alertMarkup = '';
        forEach(alertMessages, function (type, messageList) {
            var typeMarkup = '<div role="alert" class="alert alert-' + type + '"><ul>';
            forEach(messageList, function (message) {
                typeMarkup += '<li>' + message + '</li>';
            });
            typeMarkup += '</ul></div>';
            alertMarkup += typeMarkup;
        });

        $('#alerts').html(alertMarkup);
        window.scrollTo(0,0);

        if (shouldThrow) {
            throw new UserInputError(message);
        }
    };

    var clearAlerts = function () {
        alert = false;
        alertMessages = {};
        $('#alerts').html('');
    };

    var disableButton = function (id) {
        $('#' + id).prop('disabled', true);
    };

    var enableButton = function (id) {
        $('#' + id).prop('disabled', false);
    };

    // # Notes on stripping and hashing.

    // Why is it stripped exactly this way? We want to eliminate as many
    // characters as possible (to eliminate possibilities that people may
    // type them differently from time to time) which still preserving
    // uniqueness. Lowercasing assumes that, e.g., 'JohnDoe' and
    // 'johndoe' are always the same person. Dropping everything but
    // letters, numbers, and periods has a similar function. The period is
    // included b/c it is a commonly allowed and commonly used separator that
    // may make the difference between, e.g., 'a.jay' and 'aja.y'.

    // Stripping is idempotent.

    // ## Abby's notes on how universities build such ids:

    // * Dartmouth:
    //   - Full name with periods between, e.g. John.A.Doe
    //   - When there is more than one person with the same name, an additional
    //     number is added, e.g. John.A.Doe-2
    // * Cornell:
    //   - initials followed by one or more numbers.
    // * Indiana & Bowling Green
    //   - Just letters

    var stripToken = function (token) {
        return token.toLowerCase().replace(/[^a-z0-9.]/g, '');
    };

    var hashToken = function (token, salt) {
        return CryptoJS.SHA256(stripToken(token) + salt);
    };

    // Break the list up into equal-sized chunks, applying f() to each item of
    // the list, writing a %-complete value to the progress span after each
    // chunk. Then execute a callback with the resulting data.
    var chunkedLoop = function (list, f, progressSpan, callback) {
        var numChunks = 10,
            chunkSize = Math.round(list.length / numChunks),
            chunkedList = [],  // will be a list of lists
            // Concatenated results of all chunks, passed to the callback.
            resultList = [],
            x,  // just a loop variable
            chunkIndex = 0;  // tracks the current chunk across timeouts

        progressSpan.html(0);

        // Splice of chunks of equal size, but allow the last one to be of an
        // arbitrary size, in case numChunks doesn't divide the length of the
        // list evenly.
        for (x = 0; x < numChunks - 1; x += 1) {
            chunkedList.push(list.splice(0, chunkSize));
        }
        chunkedList.push(list);

        // Schedule a series of timeouts, one for each chunk. The browser
        // stops blocking for a moment between each chunk, allowing the screen
        // to update. This is the only way to have progress values reported to
        // the view mid-loop. If it was done in a single loop, execution would
        // block all the way to the end, and the screen would only update once
        // at 100%.
        var chunkFunction = function () {
            setTimeout(function () {
                // Run f on the chunk.
                var chunk = chunkedList[chunkIndex];
                var r = forEach(chunk, f);
                resultList = resultList.concat(r);
                chunkIndex += 1;

                // Update progress on the screen.
                progressSpan.html(Math.round(chunkIndex / numChunks * 100));

                // Schedule the next run, if this isn't the last chunk. If it
                // is the last chunk, execute the callback with the results.
                if (chunkIndex < chunkedList.length) {
                    chunkFunction();
                } else if (callback instanceof Function) {
                    callback.call(undefined, resultList);
                }
            // There's no reason to delay more than the minimum one
            // millisecond, since the point is just to break up javascript's
            // single-threaded blocking.
            }, 1);
        };

        chunkFunction();
    };

    // ** Functions for Deidentifier only. ** //

    // The bulk of the flops happen here.
    // Accepts and returns the whole row as a string. Hashes data found in the
    // field designated by tokenIndex (calculated earlier in deidentify()).
    var hashRow = function (rowString) {
        var rowArray = rowString.split(separator),
            rawToken = rowArray[tokenIndex],
            hashedToken = hashToken(rawToken, salt);
        rowArray.splice(tokenIndex, 1, hashedToken);
        return rowArray.join(separator);
    };

    var deidentify = function () {
        clearAlerts();
        disableButton('deidentifyButton');

        // Read user data
        salt = $('#saltInput').val();
        var textarea = $('#dataTextarea'),
            rows = textarea.val().split('\n'),
            // Store column header row separately.
            providedColumns = rows.splice(0, 1)[0].split(separator);
        tokenIndex = providedColumns.indexOf(tokenColumnName);

        // Validate user data.
        if (!saltRegex.testString(salt)) {
            // See regex definition above.
            displayAlert('danger', "Invalid salt: " + salt);
        }
        if (rows.length > maximumRows) {
            displayAlert('danger', "Exceeded row limit of 1,000,000.");
        } else if (rows.length === 0) {
            displayAlert('danger', "No data rows found.");
        } else {
            var sampleId = rows[0].split(separator)[tokenIndex];
            if (!tokenRegex.testString(sampleId)) {
                displayAlert(
                    'danger',
                    "Student id didn't match expected pattern: " + sampleId
                );
            }
            forEach(rows, function (r, i) {
                var fields = r.split(separator);
                if (fields.length !== providedColumns.length) {
                    displayAlert('danger', "Malformed data. Row " + (i + 2) +
                        " has the wrong number of values." +
                        trailingLinesWarning);
                }
                if (!fields[tokenIndex]) {
                    displayAlert('danger', "Student token missing on row " +
                        (i + 2) + ".");
                }
            });
        }
        var tokenFound = false;
        forEach(providedColumns, function (colName) {
            if (colName === tokenColumnName) {
                if (!tokenFound) {
                    tokenFound = true;
                } else {
                    displayAlert('danger',
                                 "Token column included more than once.");
                }
            }
        });
        if (!providedColumns.contains(tokenColumnName)) {
            displayAlert(
                'danger',
                "Invalid headers. Must be tab-separated and " +
                    "include the column '" + tokenColumnName + "'."
            );
        }

        // If any alerts have been raised, don't process the data.
        if (alert) {
            enableButton('deidentifyButton');
            return;
        }

        // Iterate over rows in 10 chunks, applying the hashRow() function to
        // each row, writing a %-complete value to the progress span after
        // each chunk. Then execute a callback with the resulting data.
        chunkedLoop(rows, hashRow, $('#progressSpan'), function (hashedRows) {
            // Change the name of the student id column.
            providedColumns[tokenIndex] = tokenColumnRename;

            // Display result.
            textarea.val(providedColumns.join(separator) + '\n' +
                         hashedRows.join('\n'));
            displayAlert('success', "Deidentification complete.");
            enableButton('deidentifyButton');
        });
    };

    // ** Functions for Email Selection only. ** //


    var checkDataSize = function () {
        var requiredColumns = ['email', 'token'];  // must be present in header
        if (mapRows.length > maximumRows || knownTokens > maximumRows) {
            displayAlert('invalid', "Exceeded row limit of 1,000,000.");
        }
        if (!mapTextarea.val() || mapRows.length === 0) {
            displayAlert('invalid', "No Email-Token Map found.");
        }
        if (!listTextarea.val()) {
            displayAlert('invalid', "No Token List found.");
        }
        if (util.arrayEqual(mapColumns, requiredColumns)) {
            emailColumnIndex = 0;
            tokenColumnIndex = 1;
        } else if (util.arrayEqual(mapColumns.sort(), requiredColumns)) {
            tokenColumnIndex = 0;
            emailColumnIndex = 1;
        } else {
            displayAlert('invalid',
                         "Values in Email-Token Map must be " +
                         "tab-separated with columns " +
                         "'token' and 'email'.");
        }
    };

    var checkMapRowFormat = function (token, email, rowIndex) {
        if (!token || !email) {
            displayAlert('invalid',
                         "Data is missing in row " + (rowIndex + 2) + ".");
        }
        if (!tokenRegex.testString(token)) {
            displayAlert('invalid',
                         "Token in Email-Token Map has less than three " +
                         "characters: " + token);
        }
        if (!emailRegex.testString(email)) {
            displayAlert('invalid', "Invalid email address: " + email);
        }
    };

    var checkTokenFormat = function (token) {
        if (!tokenRegex.testString(token)) {
            displayAlert('invalid', "Invalid token: " + token +
                ". Each should have 3 or more characters and no spaces or " +
                "other whitespace." + trailingLinesWarning);
        }
        return stripToken(token);
    };

    var checkEmailAndTokenUniqueness = function () {
        if (mapTokens.length !== util.arrayUnique(mapTokens).length) {
            displayAlert('invalid', "Duplicate tokens in Email-Token Map.");
        }
        if (mapEmails.length !== util.arrayUnique(mapEmails).length) {
            displayAlert('invalid', "Duplicate emails in Email-Token Map.");
        }
        if (knownTokens.length !== util.arrayUnique(knownTokens).length) {
            displayAlert('invalid', "Duplicate tokens in Token List.");
        }
    };

    var indexEmailTokenMap = function () {
        // Reset data that might be left over from previous runs.
        mapIndex = {};
        mapTokens = [];
        mapEmails = [];

        forEach(mapRows, function (row, rowIndex) {
            if (alert) { return; }

            var fields = row.split(separator),
                token = fields[tokenColumnIndex],
                email = fields[emailColumnIndex];

            if (fields.length !== 2) {
                displayAlert('danger', "Malformed data. Row " + (rowIndex + 2) +
                    " has the wrong number of values." +
                    trailingLinesWarning);
            }

            token = checkTokenFormat(token);
            checkMapRowFormat(token, email, rowIndex);

            mapIndex[token] = email;
            mapTokens.push(token);
            mapEmails.push(email);
        });
    };

    var selectEmails = function () {
        clearAlerts();
        disableButton('emailButton');

        // Read user data
        mapTextarea = $('#mapTextarea');
        listTextarea = $('#listTextarea');
        mapRows = mapTextarea.val().split('\n');
        mapColumns = mapRows.splice(0, 1)[0].split(separator);
        knownTokens = listTextarea.val().split('\n');

        // Each of these check functions may call displayAlert of type
        // 'invalid', which also throws an Error. Catching the error and
        // returning is a convenient way to stop the function and let the user
        // try again.
        try {
            // Check that the data is present and can be processed.
            checkDataSize();
            // Check the tokens in the Token List look good, and strip them.
            knownTokens = forEach(knownTokens, checkTokenFormat);
            // Process everything into convenient data structures.
            indexEmailTokenMap();
            // Do a uniqueness check on everything. Better to alert the user
            // that they've pasted bad data than silently give a problematic
            // result.
            checkEmailAndTokenUniqueness();
        } catch (e) {
            // Don't continue processing. Let the user read alerts and
            // re-submit.
            if (e instanceof UserInputError) {
                enableButton('emailButton');
                return;
            }

            // Else rethrow to expose errors we don't expect.
            throw e;
        }

        // Actually do the requested processing.
        var emailsNotInList = forEach(mapIndex, function (token, email) {
            if (!knownTokens.contains(token)) { return email; }
        });
        var tokensNotInMap = forEach(knownTokens, function (token) {
            if (!mapIndex[token]) { return token; }
        });

        // Display result.
        $('#resultPre').html(emailsNotInList.join("\n") || "No emails found.");
        $('#notFoundNumSpan').html(tokensNotInMap.length);
        $('#notFoundPre').html(tokensNotInMap.join("\n"));

        if (tokensNotInMap.length === knownTokens.length) {
            displayAlert('warning',
                         "None of the listed tokens were found in the Email-" +
                         "Token Map. Please check your data sources.");
        } else {
            displayAlert('success', "Processing complete.");
        }
        enableButton('emailButton');
    };

    // ** Functions for Panel Redirection Map ** //

    var checkPanelFormat = function (rows, columns) {
        // Checking .length < 2 here b/c ''.split('\t') is [''], not [].
        if (rows.length === 0 || columns.length < 2) {
            enableButton('uploadButton');
            displayAlert('invalid', "No data found.");
        }

        forEach(panelRequiredColumns, function (col) {
            if (!columns.contains(col)) {
                enableButton('uploadButton');
                displayAlert('invalid', "Invalid columns in csv. Must " +
                    "include '" + panelRequiredColumns.join("', '") + "'.");
            }
        });

        forEach(rows, function (r, i) {
            if (r.split(separator).length !== columns.length) {
                enableButton('uploadButton');
                displayAlert('invalid', "Malformed data. Row " + (i + 2) +
                    " has the wrong number of values." +
                    trailingLinesWarning);
            }
        });
    };

    var openEditLinkMode = function () {
        $('#updateLinkInput').prop('readonly', null)
                             .parent().toggleClass('open');
        $('#editLinkButton').html('Cancel');
        disableButton('uploadButton');
        enableButton('updateLinkButton');
    };

    var closeEditLinkMode = function () {
        var cohortCode = $('#cohortCodeSelect').val();
        $('#updateLinkInput').prop('readonly', true)
                             .val(cohortIndex[cohortCode])
                             .parent().toggleClass('open');
        $('#editLinkButton').html('Edit');
        enableButton('uploadButton');
        disableButton('updateLinkButton');
    };

    var createCohort = function () {
        clearAlerts();
        disableButton('createCohortButton');
        disableButton('updateLinkButton');
        disableButton('uploadButton');
        var cohortCode = $('#cohortCodeInput').val(),
            anonymousLink = $('#anonymousLinkInput').val();

        $.ajax('/panel_redirection_map', {
            method: 'POST',
            data: {
                cohort_code: cohortCode,
                anonymous_link: anonymousLink
            },
            success: function (data, status, xhr) {
                if (data === 'True') {
                    displayAlert('success', "Created cohort. Refreshing...");
                    setTimeout(function () {
                        window.location.reload();
                    }, 2 * 1000);
                } else if (data.contains('Duplicate entry')) {
                    displayAlert('danger', "Cohort '" + cohortCode +
                        "' already exists.");
                    enableButton('createCohortButton');
                } else {
                    displayAlert('danger', "Error during upload: " + data);
                    enableButton('createCohortButton');
                }
            },
            error: function (xhr, status, error) {
                throw new Error(error);
            }
        });
    };

    var updateLink = function () {
        clearAlerts();
        disableButton('updateLinkButton');
        disableButton('uploadButton');
        var cohortCode = $('#cohortCodeSelect').val(),
            anonymousLink = $('#updateLinkInput').val();

        $.ajax('/panel_redirection_map', {
            method: 'PUT',
            data: {
                cohort_code: cohortCode,
                anonymous_link: anonymousLink
            },
            success: function (data, status, xhr) {
                if (data === 'True') {
                    displayAlert('success', "Updated link. Refreshing...");
                    setTimeout(function () {
                        window.location.reload();
                    }, 2 * 1000);
                } else {
                    displayAlert('danger', "Error during upload: " + data);
                    enableButton('updateLinkButton');
                    enableButton('uploadButton');
                }
            },
            error: function (xhr, status, error) {
                throw new Error(error);
            }
        });
    };

    var uploadPanel = function () {
        clearAlerts();
        disableButton('uploadButton');

        var panelCsv = $('#panelTextarea').val(),
            panelRows = panelCsv.split("\n"),
            panelColumns = panelRows.splice(0, 1)[0].split(separator),
            cohortCode = $('#cohortCodeSelect').val();

        // Qualtrics uses annoying capitalization and whitespace.
        panelColumns = forEach(panelColumns, function (col) {
            return col.toLowerCase().replace(/ /g, '_');
        });

        try {
            if (!cohortCode) {
                displayAlert('invalid', "All fields required.");
            }
            checkPanelFormat(panelRows, panelColumns);
        } catch (e) {
            if (e instanceof UserInputError) { return; }
            throw e;
        }

        // Simplify the data to just the columns we care about.
        var p = []
        var colIndices = forEach(panelRequiredColumns, function (col) {
            return panelColumns.indexOf(col);
        });
        forEach(panelRows, function (rowString) {
            var row = rowString.split('\t');
            row = forEach(colIndices, function (i) { return row[i]; });
            p.push(row.join('\t'));
        });

        var simplePanel = panelRequiredColumns.join('\t') + '\n' +
                          p.join('\n');

        $.ajax('/panel_redirection_map', {
            method: 'POST',
            data: {
                cohort_code: cohortCode,
                panel: simplePanel
            },
            success: function (data, status, xhr) {
                if (data === 'True') {
                    displayAlert('success', "Upload successful.");
                    $('#panelTextarea').val('');
                } else {
                    displayAlert('danger', "Error during upload. Please " +
                        "check data and try again.");
                }
                enableButton('uploadButton');
            },
            error: function (xhr, status, error) {
                throw new Error(error);
            }
        });
    };

    // ** PageLoad Execution ** //

    $(function () {
        if (window.location.pathname === '/panel_redirection_map') {
            // Index the cohort data for easy lookups. They're dumped to page as
            // as JSON list of dictionaries.
            forEach(window.cohorts, function (row) {
                cohortIndex[row.cohort_code] = row.anonymous_link;
            });


            $('#cohortCodeSelect').change(function () {
                var newLink = cohortIndex[$(this).val()];
                $('#updateLinkInput').val(newLink);
            });

            $('#updateLinkInput').val(window.cohorts[0].anonymous_link);

            $('#editLinkButton').click(function () {
                if ($('#updateLinkInput').prop('readonly')) {
                    openEditLinkMode();
                } else {
                    closeEditLinkMode();
                }
            });
        }
    });

    return {
        deidentify: deidentify,
        selectEmails: selectEmails,
        createCohort: createCohort,
        updateLink: updateLink,
        uploadPanel: uploadPanel
    };

}());
