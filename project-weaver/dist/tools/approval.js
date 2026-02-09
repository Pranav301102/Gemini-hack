import { z } from 'zod';
import { BoardManager } from '../context/board.js';
export function registerApproval(server) {
    // --- request_plan_approval ---
    server.tool('request_plan_approval', 'Set the plan status to "pending" so the user can review and approve it from the dashboard. Call this after the plan is finalized and ready for human review. The dashboard will show an approval gate UI.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        summary: z.string().optional().describe('Brief summary of what the plan covers, shown to the user'),
    }, async ({ workspacePath, summary }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized. Run init_project first.' }) }],
            };
        }
        const board = manager.readBoard();
        if (!board.plan) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'No plan exists yet. Create a plan first using the planning tools.' }) }],
            };
        }
        // Set approval to pending
        board.approval = {
            status: 'pending',
            reviewedBy: 'user',
            revisionCount: board.approval?.revisionCount ?? 0,
        };
        manager.writeBoard(board);
        // Add a context entry so the dashboard activity feed shows this
        manager.addEntry({
            agent: 'product-manager',
            phase: board.phase,
            type: 'question',
            title: 'Plan Ready for Review',
            content: summary
                ? `The plan is ready for your review.\n\n**Summary:** ${summary}\n\nPlease review and approve from the dashboard.`
                : 'The plan is ready for your review. Please approve or request changes from the dashboard.',
        });
        manager.logEvent({
            level: 'info',
            action: 'approval_requested',
            message: 'Plan submitted for user approval via dashboard',
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: 'Plan submitted for approval. The user will review it in the dashboard. Use check_plan_approval to poll for their decision.',
                        status: 'pending',
                    }),
                }],
        };
    });
    // --- check_plan_approval ---
    server.tool('check_plan_approval', 'Check the current approval status of the plan. Use this to poll after calling request_plan_approval. Returns the status (pending, approved, changes-requested) and any user comments.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const board = manager.readBoard();
        const approval = board.approval;
        if (!approval) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            status: 'none',
                            message: 'No approval has been requested yet. Use request_plan_approval to submit the plan for review.',
                        }),
                    }],
            };
        }
        const response = {
            success: true,
            status: approval.status,
            reviewedBy: approval.reviewedBy,
            revisionCount: approval.revisionCount,
        };
        if (approval.status === 'approved') {
            response.message = 'Plan approved! Proceed with implementation.';
            response.phase = board.phase;
        }
        else if (approval.status === 'changes-requested') {
            response.message = 'User requested changes. Review their feedback and revise the plan.';
            response.comments = approval.comments;
        }
        else {
            response.message = 'Still waiting for user approval. Check again shortly.';
        }
        if (approval.reviewedAt) {
            response.reviewedAt = approval.reviewedAt;
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(response),
                }],
        };
    });
}
//# sourceMappingURL=approval.js.map