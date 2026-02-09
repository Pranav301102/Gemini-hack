import { z } from 'zod';
import { BoardManager } from '../context/board.js';
import { AGENT_DISPLAY_NAMES, DOC_CATEGORY_LABELS } from '../types.js';
const agentEnum = z.enum(['product-manager', 'architect', 'developer', 'qa', 'code-reviewer']);
const categoryEnum = z.enum(['api', 'architecture', 'setup', 'feature', 'decision', 'runbook', 'changelog']);
export function registerDocs(server) {
    // --- add_doc ---
    server.tool('add_doc', 'Add a document to the centralized .weaver/docs.json collection. All project documentation should go here instead of scattered README/doc files in the codebase.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        category: categoryEnum.describe('Document category: api, architecture, setup, feature, decision, runbook, changelog'),
        title: z.string().describe('Document title'),
        content: z.string().describe('Document content in markdown'),
        agent: agentEnum.describe('Agent creating this document'),
        tags: z.array(z.string()).optional().describe('Tags for searchability'),
    }, async ({ workspacePath, category, title, content, agent, tags }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const doc = manager.addDoc({
            category: category,
            title,
            content,
            agent,
            tags: tags ?? [],
        });
        manager.logEvent({
            level: 'info',
            agent,
            action: 'doc_added',
            message: `${AGENT_DISPLAY_NAMES[agent]} added doc: "${title}" [${category}]`,
            data: { docId: doc.id, category, title },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Document "${title}" added to ${DOC_CATEGORY_LABELS[category]}`,
                        docId: doc.id,
                        category,
                    }),
                }],
        };
    });
    // --- get_docs ---
    server.tool('get_docs', 'Query the centralized documentation collection. Filter by category, tag, search text, or specific ID.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        category: categoryEnum.optional().describe('Filter by category'),
        tag: z.string().optional().describe('Filter by tag'),
        search: z.string().optional().describe('Search text in title and content'),
        id: z.string().optional().describe('Get a specific document by ID'),
    }, async ({ workspacePath, category, tag, search, id }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const docs = manager.getDocs({
            category: category,
            tag,
            search,
            id,
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        totalDocs: docs.length,
                        docs: id
                            ? docs
                            : docs.map(d => ({
                                id: d.id,
                                category: d.category,
                                title: d.title,
                                agent: d.agent,
                                tags: d.tags,
                                createdAt: d.createdAt,
                                updatedAt: d.updatedAt,
                                revisionCount: d.revisions.length,
                                contentPreview: d.content.substring(0, 200) + (d.content.length > 200 ? '...' : ''),
                            })),
                    }),
                }],
        };
    });
    // --- update_doc ---
    server.tool('update_doc', 'Update an existing document in the collection. Records the previous version as a revision.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        id: z.string().describe('Document ID to update'),
        agent: agentEnum.describe('Agent making the update'),
        title: z.string().optional().describe('Updated title'),
        content: z.string().optional().describe('Updated content (markdown)'),
        tags: z.array(z.string()).optional().describe('Updated tags'),
    }, async ({ workspacePath, id, agent, title, content, tags }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const updates = {};
        if (title !== undefined)
            updates.title = title;
        if (content !== undefined)
            updates.content = content;
        if (tags !== undefined)
            updates.tags = tags;
        const doc = manager.updateDoc(id, updates, agent);
        if (!doc) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: `Document with ID "${id}" not found.` }),
                    }],
            };
        }
        manager.logEvent({
            level: 'info',
            agent,
            action: 'doc_updated',
            message: `${AGENT_DISPLAY_NAMES[agent]} updated doc: "${doc.title}" [${doc.category}]`,
            data: { docId: id, category: doc.category, updatedFields: Object.keys(updates) },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Document "${doc.title}" updated`,
                        docId: id,
                        revisionCount: doc.revisions.length,
                    }),
                }],
        };
    });
    // --- list_doc_categories ---
    server.tool('list_doc_categories', 'List all documentation categories with document counts and last update timestamps.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const collection = manager.readDocs();
        const categoryMap = new Map();
        for (const cat of ['api', 'architecture', 'setup', 'feature', 'decision', 'runbook', 'changelog']) {
            categoryMap.set(cat, { count: 0, latestUpdate: '' });
        }
        for (const doc of collection.docs) {
            const existing = categoryMap.get(doc.category) ?? { count: 0, latestUpdate: '' };
            existing.count++;
            if (doc.updatedAt > existing.latestUpdate) {
                existing.latestUpdate = doc.updatedAt;
            }
            categoryMap.set(doc.category, existing);
        }
        const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
            name,
            label: DOC_CATEGORY_LABELS[name],
            count: data.count,
            latestUpdate: data.latestUpdate || null,
        }));
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        totalDocs: collection.docs.length,
                        categories,
                    }),
                }],
        };
    });
}
//# sourceMappingURL=docs.js.map