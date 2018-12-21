/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 - present Instructure, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const { execSync } = require('child_process');
const commitAnalyzer = require('@semantic-release/commit-analyzer');
const chalk = require('chalk');
const buildCommit = require('cz-customizable/buildCommit');
const autocomplete = require('inquirer-autocomplete-prompt');
const makeDefaultQuestions = require('./make-default-questions');
const autocompleteQuestions = require('./autocomplete-questions');

const cwd = process.cwd();

function getCommitTypeMessage(type) {
  if (!type) {
    return 'This commit does not indicate any release';
  }
  return {
    patch: '🛠  This commit indicates a patch release (0.0.X)',
    minor: '✨  This commit indicates a minor release (0.X.0)',
    major: '💥  This commit indicates a major release (X.0.0)',
  }[type];
}

function getPackages() {
  try {
    return JSON.parse(
      execSync('lerna list --all --json', { encoding: 'utf8', cwd }),
    );
  } catch (e) {
    chalk.red('Failed to get packages', e);
    process.exit(1);
  }
  return [];
}

function getChangedPackages() {
  try {
    return JSON.parse(
      execSync('lerna list --since head --all --json', {
        encoding: 'utf8',
        cwd,
      }),
    );
  } catch (e) {
    chalk.red('Failed to get changed packages', e);
    process.exit(1);
  }
  return [];
}

function removeScope(name) {
  return name.replace(/^@[^/]+\//, '');
}

function makePrompter() {
  return function (cz, commit) {
    const changedPackages = exports
      .getChangedPackages()
      .map(exports.removeScope);
    const packageNames = exports.getPackages().map(exports.removeScope);
    const questions = makeDefaultQuestions(packageNames, changedPackages);

    // eslint-disable-next-line no-console
    console.log(
      '\n\nLine 1 will be cropped at 100 characters. All other lines will be wrapped after 100 characters.\n',
    );

    cz.registerPrompt('autocomplete', autocomplete);

    cz.prompt(autocompleteQuestions(questions)).then((answers) => {
      const {
        scope, body, footer, ...rest
      } = answers;

      const testplan = answers.testplan
        ? `\nTEST PLAN:\n${answers.testplan}\n\n`
        : '';
      const issues = footer ? `\n\nrefs: ${footer}\n\n` : '';

      const message = buildCommit({
        ...rest,
        body: issues + body + testplan,
        scope: scope && scope.length > 0 ? scope.join(',') : '*',
      });

      commitAnalyzer({}, { commits: [{ hash: '', message }], logger: console })
        .then((type) => {
          /* eslint-disable no-console */
          console.log(chalk.green(`\n${getCommitTypeMessage(type)}\n`));
          console.log('\n\nCommit message:');
          console.log(chalk.blue(`\n\n${message}\n`));
          /* eslint-enable no-console */
          commit(message);
        })
        .catch((error) => {
          console.error(error);
        });
    });
  };
}

exports.prompter = makePrompter();
exports.getChangedPackages = getChangedPackages;
exports.getPackages = getPackages;
exports.removeScope = removeScope;
