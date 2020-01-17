import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Octokit from '@octokit/rest';

type Issue = Octokit.IssuesListForRepoResponseItem;
type IssueLabel = Octokit.IssuesListForRepoResponseItemLabelsItem;

type Args = {
  repoToken: string;
  daysBeforeStale: number;
  daysBeforeClose: number;
  staleMessage: string;
  staleLabel: string;
  exemptLabels: Array<string>;
  operationsPerRun: number;
  dryRun: boolean;
};

async function run() {
  try {
    const args = getAndValidateArgs();

    const client = new github.GitHub(args.repoToken);
    await processIssues(client, args, args.operationsPerRun);
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

async function processIssues(
  client: github.GitHub,
  args: Args,
  operationsLeft: number,
  page: number = 1
): Promise<number> {
  const issues = await client.issues.listForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'open',
    per_page: 100,
    page: page
  });

  operationsLeft -= 1;

  if (issues.data.length === 0 || operationsLeft === 0) {
    return operationsLeft;
  }

  for (var issue of issues.data.values()) {
    // Skip Pull Requests
    if (!!issue.pull_request) {
      continue;
    }

    // Skip Exempt issues
    if (args.exemptLabels.length && isExempt(issue, args.exemptLabels)) {
      continue;
    }

    // Check if it's a stale issue
    if (isLabeled(issue, args.staleLabel)) {
      if (wasLastUpdatedBefore(issue, args.daysBeforeClose)) {
        operationsLeft -= await closeIssue(client, issue, args.dryRun);
      } else {
        continue;
      }
    } else if (wasLastUpdatedBefore(issue, args.daysBeforeStale)) {
      operationsLeft -= await markStale(
        client,
        issue,
        args.staleMessage,
        args.staleLabel,
        args.dryRun
      );
    }

    if (operationsLeft <= 0) {
      core.warning(
        `performed ${args.operationsPerRun} operations, exiting to avoid rate limit`
      );
      return 0;
    }
  }

  return await processIssues(client, args, operationsLeft, page + 1);
}

function isLabeled(issue: Issue, label: string): boolean {
  const labelComparer: (l: IssueLabel) => boolean = l =>
    label.localeCompare(l.name, undefined, {sensitivity: 'accent'}) === 0;
  return issue.labels.filter(labelComparer).length > 0;
}

function isExempt(issue: Issue, labels: Array<string>): boolean {
  let issueLabels = issue.labels;
  for (let l of issueLabels) {
    let lowerCaseLabel = l.name.toLowerCase();
    if (labels.find(exemptLabel => lowerCaseLabel.includes(exemptLabel))) {
      return true;
    }
  }

  return false;
}

function wasLastUpdatedBefore(issue: Issue, num_days: number): boolean {
  const daysInMillis = 1000 * 60 * 60 * 24 * num_days;
  const millisSinceLastUpdated =
    new Date().getTime() - new Date(issue.updated_at).getTime();
  return millisSinceLastUpdated >= daysInMillis;
}

async function markStale(
  client: github.GitHub,
  issue: Issue,
  staleMessage: string,
  staleLabel: string,
  isDryRun: boolean
): Promise<number> {
  core.debug(
    `[STALE] Marking issue #${issue.number} ${issue.title} last updated ${issue.updated_at}`
  );

  // Do not perform operation on dry run
  if (isDryRun) return 0;

  await client.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    body: staleMessage
  });

  await client.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    labels: [staleLabel]
  });

  return 2; // operations performed
}

async function closeIssue(
  client: github.GitHub,
  issue: Issue,
  isDryRun: boolean
): Promise<number> {
  core.debug(
    `[STALE] Closing issue #${issue.number} ${issue.title} last updated ${issue.updated_at}`
  );

  // Do not perform operation on dry run
  if (isDryRun) return 0;

  await client.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    state: 'closed'
  });

  return 1; // operations performed
}

function getAndValidateArgs(): Args {
  const args = {
    repoToken: core.getInput('repo-token', {required: true}),
    daysBeforeStale: parseInt(
      core.getInput('days-before-stale', {required: true})
    ),
    daysBeforeClose: parseInt(
      core.getInput('days-before-close', {required: true})
    ),
    staleMessage: core.getInput('stale-message', {required: true}),
    staleLabel: core.getInput('stale-label', {required: true}),
    exemptLabels: core.getInput('exempt-labels', {required: true}).split(','),
    operationsPerRun: parseInt(
      core.getInput('operations-per-run', {required: true})
    ),
    dryRun: core.getInput('dry-run') == 'true'
  };

  for (var numberInput of [
    'days-before-stale',
    'days-before-close',
    'operations-per-run'
  ]) {
    if (isNaN(parseInt(core.getInput(numberInput)))) {
      throw Error(`input ${numberInput} did not parse to a valid integer`);
    }
  }

  args.exemptLabels = args.exemptLabels.map(exemptLabel =>
    exemptLabel.trim().toLowerCase()
  );

  return args;
}

run();
