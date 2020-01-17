"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const args = getAndValidateArgs();
            const client = new github.GitHub(args.repoToken);
            yield processIssues(client, args, args.operationsPerRun);
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
function processIssues(client, args, operationsLeft, page = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        const issues = yield client.issues.listForRepo({
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
                    operationsLeft -= yield closeIssue(client, issue, args.dryRun);
                }
                else {
                    continue;
                }
            }
            else if (wasLastUpdatedBefore(issue, args.daysBeforeStale)) {
                operationsLeft -= yield markStale(client, issue, args.staleMessage, args.staleLabel, args.dryRun);
            }
            if (operationsLeft <= 0) {
                core.warning(`performed ${args.operationsPerRun} operations, exiting to avoid rate limit`);
                return 0;
            }
        }
        return yield processIssues(client, args, operationsLeft, page + 1);
    });
}
function isLabeled(issue, label) {
    const labelComparer = l => label.localeCompare(l.name, undefined, { sensitivity: 'accent' }) === 0;
    return issue.labels.filter(labelComparer).length > 0;
}
function isExempt(issue, labels) {
    let issueLabels = issue.labels;
    for (let l of issueLabels) {
        let lowerCaseLabel = l.name.toLowerCase();
        if (labels.find(exemptLabel => lowerCaseLabel.includes(exemptLabel))) {
            return true;
        }
    }
    return false;
}
function wasLastUpdatedBefore(issue, num_days) {
    const daysInMillis = 1000 * 60 * 60 * 24 * num_days;
    const millisSinceLastUpdated = new Date().getTime() - new Date(issue.updated_at).getTime();
    return millisSinceLastUpdated >= daysInMillis;
}
function markStale(client, issue, staleMessage, staleLabel, isDryRun) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug(`[STALE] Marking issue #${issue.number} ${issue.title} last updated ${issue.updated_at}`);
        // Do not perform operation on dry run
        if (isDryRun)
            return 0;
        yield client.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue.number,
            body: staleMessage
        });
        yield client.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue.number,
            labels: [staleLabel]
        });
        return 2; // operations performed
    });
}
function closeIssue(client, issue, isDryRun) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug(`[STALE] Closing issue #${issue.number} ${issue.title} last updated ${issue.updated_at}`);
        // Do not perform operation on dry run
        if (isDryRun)
            return 0;
        yield client.issues.update({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue.number,
            state: 'closed'
        });
        return 1; // operations performed
    });
}
function getAndValidateArgs() {
    const args = {
        repoToken: core.getInput('repo-token', { required: true }),
        daysBeforeStale: parseInt(core.getInput('days-before-stale', { required: true })),
        daysBeforeClose: parseInt(core.getInput('days-before-close', { required: true })),
        staleMessage: core.getInput('stale-issue-message', { required: true }),
        staleLabel: core.getInput('stale-issue-label', { required: true }),
        exemptLabels: core
            .getInput('exempt-issue-label', { required: true })
            .split(','),
        operationsPerRun: parseInt(core.getInput('operations-per-run', { required: true })),
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
    args.exemptLabels = args.exemptLabels.map(exemptLabel => exemptLabel.trim().toLowerCase());
    return args;
}
run();
