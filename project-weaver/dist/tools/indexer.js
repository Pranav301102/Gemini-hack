import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, Lang } from '@ast-grep/napi';
import { BoardManager } from '../context/board.js';
// Directories to skip (same as read-project)
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '__pycache__',
    '.cache', '.vscode', '.idea', 'coverage', '.weaver', '.turbo', '.output',
    'vendor', 'target', 'bin', 'obj', '.gradle', '.mvn', 'venv', '.venv', 'env',
]);
// File extensions we index
const INDEXABLE_EXTENSIONS = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.cs': 'C#',
    '.cpp': 'C++', '.cc': 'C++', '.c': 'C', '.h': 'C/C++', '.hpp': 'C++',
    '.swift': 'Swift',
    '.php': 'PHP',
    '.kt': 'Kotlin',
};
// Map file extension to ast-grep Lang (only for supported languages)
function getAstLang(ext) {
    switch (ext) {
        case '.ts': return Lang.TypeScript;
        case '.tsx':
        case '.jsx': return Lang.Tsx;
        case '.js':
        case '.mjs':
        case '.cjs': return Lang.JavaScript;
        default: return null;
    }
}
// ─── AST Helpers ───
function findChild(node, kind) {
    return node.children().find(c => c.kind() === kind) ?? null;
}
function findChildren(node, kind) {
    return node.children().filter(c => c.kind() === kind);
}
function findNamedChild(node, kind) {
    return node.children().find(c => c.isNamed() && c.kind() === kind) ?? null;
}
/** Extract JSDoc description from a comment node */
function extractJSDoc(commentText) {
    if (!commentText.startsWith('/**'))
        return undefined;
    // Strip /** and */, then clean up leading * on each line
    const body = commentText
        .replace(/^\/\*\*\s*/, '')
        .replace(/\s*\*\/$/, '')
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => !line.startsWith('@')) // Skip @param, @returns, etc.
        .join(' ')
        .trim();
    return body || undefined;
}
/** Get JSDoc from the previous sibling (if it's a comment) */
function getJSDocFromPrev(node) {
    const prev = node.prev();
    if (prev && prev.kind() === 'comment') {
        return extractJSDoc(prev.text());
    }
    return undefined;
}
/** Get the file-level description from the first comment in the file */
function getFileDescription(root) {
    const first = root.children().find(c => c.kind() === 'comment');
    if (first && first.range().start.line < 3) {
        return extractJSDoc(first.text());
    }
    return undefined;
}
/** Extract parameters from a formal_parameters node */
function extractParams(paramsNode) {
    if (!paramsNode)
        return [];
    const results = [];
    for (const child of paramsNode.children()) {
        const kind = child.kind();
        if (kind === 'required_parameter' || kind === 'optional_parameter') {
            const nameNode = findNamedChild(child, 'identifier') ?? findNamedChild(child, 'object_pattern') ?? findNamedChild(child, 'array_pattern');
            const typeNode = findNamedChild(child, 'type_annotation');
            if (nameNode) {
                const name = nameNode.kind() === 'identifier' ? nameNode.text() : nameNode.text().substring(0, 40);
                const type = typeNode ? typeNode.text().replace(/^:\s*/, '').trim() : undefined;
                results.push({ name, type });
            }
        }
        else if (kind === 'identifier') {
            // Plain JS parameter without type
            results.push({ name: child.text() });
        }
        else if (kind === 'assignment_pattern') {
            // Parameter with default value
            const nameNode = child.children().find(c => c.kind() === 'identifier');
            if (nameNode)
                results.push({ name: nameNode.text() });
        }
        else if (kind === 'rest_pattern') {
            const nameNode = findNamedChild(child, 'identifier');
            if (nameNode)
                results.push({ name: '...' + nameNode.text() });
        }
    }
    return results;
}
/** Get return type string from a type_annotation node */
function getReturnType(node) {
    const typeAnnotation = findNamedChild(node, 'type_annotation');
    if (typeAnnotation) {
        return typeAnnotation.text().replace(/^:\s*/, '').trim();
    }
    return undefined;
}
/** Check if an arrow function body contains JSX (React component) */
function hasJSXReturn(node) {
    const body = findNamedChild(node, 'statement_block') ?? findNamedChild(node, 'parenthesized_expression');
    if (!body) {
        // Single-expression body — check if it's JSX
        return node.children().some(c => c.kind() === 'jsx_element' || c.kind() === 'jsx_self_closing_element' || c.kind() === 'jsx_fragment');
    }
    // Look for return statements with JSX in the body
    const returns = body.findAll('return_statement');
    for (const ret of returns) {
        const text = ret.text();
        if (text.includes('<') && (text.includes('/>') || text.includes('</'))) {
            return true;
        }
    }
    return false;
}
/** Check if a type annotation refers to React.FC or similar */
function isReactFCType(typeText) {
    if (!typeText)
        return false;
    return /^React\.\s*(FC|FunctionComponent|VFC|ComponentType)|^FC\b|^FunctionComponent\b/.test(typeText);
}
function extractWithAST(content, ext) {
    const lang = getAstLang(ext);
    if (!lang)
        throw new Error(`No AST lang for ${ext}`);
    const root = parse(lang, content).root();
    const result = {
        functions: [],
        classes: [],
        variables: [],
        exports: [],
        imports: [],
        types: [],
        description: getFileDescription(root),
    };
    // Process top-level nodes
    for (const node of root.children()) {
        processTopLevel(node, false, result);
    }
    return result;
}
function processTopLevel(node, isExported, result) {
    const kind = node.kind();
    switch (kind) {
        case 'export_statement':
            processExportStatement(node, result);
            break;
        case 'function_declaration':
            result.functions.push(extractFunctionDecl(node, isExported));
            break;
        case 'lexical_declaration':
        case 'variable_declaration':
            processVariableDeclaration(node, isExported, result);
            break;
        case 'class_declaration':
            result.classes.push(extractClassDecl(node, isExported));
            break;
        case 'interface_declaration':
            result.types.push(extractInterfaceDecl(node));
            if (isExported) {
                const name = findNamedChild(node, 'type_identifier')?.text();
                if (name)
                    result.exports.push(name);
            }
            break;
        case 'type_alias_declaration':
            result.types.push(extractTypeAlias(node));
            if (isExported) {
                const name = findNamedChild(node, 'type_identifier')?.text();
                if (name)
                    result.exports.push(name);
            }
            break;
        case 'enum_declaration':
            result.types.push(extractEnumDecl(node));
            if (isExported) {
                const name = findNamedChild(node, 'identifier')?.text();
                if (name)
                    result.exports.push(name);
            }
            break;
        case 'import_statement':
            extractImportStatement(node, result);
            break;
    }
}
function processExportStatement(node, result) {
    const children = node.children().filter(c => c.isNamed());
    // Check for export clause: export { a, b } or export { a } from 'module'
    const exportClause = findNamedChild(node, 'export_clause');
    if (exportClause) {
        for (const spec of findChildren(exportClause, 'export_specifier')) {
            const identifiers = findChildren(spec, 'identifier');
            // If "as" rename, use the second identifier (the exported name)
            const exportedName = identifiers.length > 1 ? identifiers[1].text() : identifiers[0]?.text();
            if (exportedName)
                result.exports.push(exportedName);
        }
        return;
    }
    // Check for export default
    const jsDoc = getJSDocFromPrev(node);
    for (const child of children) {
        const ck = child.kind();
        if (ck === 'function_declaration') {
            const fn = extractFunctionDecl(child, true);
            fn.description = fn.description ?? jsDoc;
            result.functions.push(fn);
            result.exports.push(fn.name);
        }
        else if (ck === 'lexical_declaration' || ck === 'variable_declaration') {
            processVariableDeclaration(child, true, result, jsDoc);
        }
        else if (ck === 'class_declaration') {
            const cls = extractClassDecl(child, true);
            cls.description = cls.description ?? jsDoc;
            result.classes.push(cls);
            result.exports.push(cls.name);
        }
        else if (ck === 'interface_declaration') {
            result.types.push(extractInterfaceDecl(child));
            const name = findNamedChild(child, 'type_identifier')?.text();
            if (name)
                result.exports.push(name);
        }
        else if (ck === 'type_alias_declaration') {
            result.types.push(extractTypeAlias(child));
            const name = findNamedChild(child, 'type_identifier')?.text();
            if (name)
                result.exports.push(name);
        }
        else if (ck === 'enum_declaration') {
            result.types.push(extractEnumDecl(child));
            const name = findNamedChild(child, 'identifier')?.text();
            if (name)
                result.exports.push(name);
        }
        else if (ck === 'identifier') {
            // export default SomeName
            result.exports.push(child.text());
        }
    }
}
function extractFunctionDecl(node, exported) {
    const nameNode = findNamedChild(node, 'identifier');
    const paramsNode = findNamedChild(node, 'formal_parameters');
    const isAsync = node.text().trimStart().startsWith('async');
    const jsDoc = getJSDocFromPrev(node);
    const body = findNamedChild(node, 'statement_block');
    const fn = {
        name: nameNode?.text() ?? 'anonymous',
        params: extractParams(paramsNode),
        returnType: getReturnType(node),
        exported,
        line: node.range().start.line + 1,
        description: jsDoc,
        isAsync,
    };
    // Check for JSX to mark as component
    if (body && hasJSXReturn(node)) {
        fn.isComponent = true;
    }
    return fn;
}
function processVariableDeclaration(node, exported, result, parentJSDoc) {
    // Determine const/let/var from the first non-named child text
    const declText = node.text();
    const kindMatch = declText.match(/^(const|let|var)\s/);
    const varKind = kindMatch?.[1] ?? 'const';
    const jsDoc = parentJSDoc ?? getJSDocFromPrev(node);
    for (const declarator of findChildren(node, 'variable_declarator')) {
        const nameNode = findNamedChild(declarator, 'identifier');
        if (!nameNode)
            continue; // Skip destructured declarations for now
        const name = nameNode.text();
        const typeAnnotation = findNamedChild(declarator, 'type_annotation');
        const typeText = typeAnnotation?.text().replace(/^:\s*/, '').trim();
        // Check if the value is an arrow function or function expression
        const arrowFn = findNamedChild(declarator, 'arrow_function');
        const funcExpr = findNamedChild(declarator, 'function');
        if (arrowFn || funcExpr) {
            const fnNode = arrowFn ?? funcExpr;
            const paramsNode = findNamedChild(fnNode, 'formal_parameters');
            const isAsync = fnNode.text().trimStart().startsWith('async');
            const isComponent = isReactFCType(typeText) || hasJSXReturn(fnNode);
            const fn = {
                name,
                params: extractParams(paramsNode),
                returnType: getReturnType(fnNode) ?? (typeText && !isReactFCType(typeText) ? undefined : undefined),
                exported,
                line: node.range().start.line + 1,
                description: jsDoc,
                isAsync,
                isComponent: isComponent || undefined,
            };
            // For arrow functions with type annotation on the variable, use that as hint
            if (!fn.returnType && typeText && !isReactFCType(typeText)) {
                // The type annotation is on the variable, not a return type
                // e.g., const handler: RequestHandler = () => {}
            }
            result.functions.push(fn);
            if (exported)
                result.exports.push(name);
            // Extract inner functions from the body
            const body = findNamedChild(fnNode, 'statement_block');
            if (body) {
                extractInnerFunctions(body, name, result);
            }
        }
        else {
            // Regular variable declaration
            const valueNode = declarator.children().find(c => c.isNamed() && c.kind() !== 'identifier' && c.kind() !== 'type_annotation');
            let valuePreview;
            if (valueNode) {
                const vt = valueNode.text();
                valuePreview = vt.length > 80 ? vt.substring(0, 77) + '...' : vt;
            }
            result.variables.push({
                name,
                type: typeText,
                value: valuePreview,
                kind: varKind,
                exported,
                line: node.range().start.line + 1,
                description: jsDoc,
            });
            if (exported)
                result.exports.push(name);
        }
    }
}
/** Extract inner functions from a function/component body (1 level deep) */
function extractInnerFunctions(body, parentName, result) {
    for (const child of body.children()) {
        const ck = child.kind();
        if (ck === 'function_declaration') {
            const fn = extractFunctionDecl(child, false);
            fn.name = `${parentName}.${fn.name}`;
            result.functions.push(fn);
        }
        else if (ck === 'lexical_declaration' || ck === 'variable_declaration') {
            // Check for arrow functions
            for (const declarator of findChildren(child, 'variable_declarator')) {
                const nameNode = findNamedChild(declarator, 'identifier');
                const arrowFn = findNamedChild(declarator, 'arrow_function');
                const funcExpr = findNamedChild(declarator, 'function');
                if (nameNode && (arrowFn || funcExpr)) {
                    const fnNode = arrowFn ?? funcExpr;
                    const paramsNode = findNamedChild(fnNode, 'formal_parameters');
                    const isAsync = fnNode.text().trimStart().startsWith('async');
                    const jsDoc = getJSDocFromPrev(child);
                    result.functions.push({
                        name: `${parentName}.${nameNode.text()}`,
                        params: extractParams(paramsNode),
                        returnType: getReturnType(fnNode),
                        exported: false,
                        line: child.range().start.line + 1,
                        description: jsDoc,
                        isAsync,
                    });
                }
            }
        }
    }
}
function extractClassDecl(node, exported) {
    const nameNode = findNamedChild(node, 'type_identifier');
    const body = findNamedChild(node, 'class_body');
    const jsDoc = getJSDocFromPrev(node);
    // Check for extends and implements
    const heritage = findNamedChild(node, 'class_heritage');
    let extendsClause;
    let implementsList;
    if (heritage) {
        const extendsNode = findNamedChild(heritage, 'extends_clause');
        if (extendsNode) {
            const typeNode = extendsNode.children().find(c => c.isNamed() && c.kind() !== 'extends');
            extendsClause = typeNode?.text();
        }
        const implementsNode = findNamedChild(heritage, 'implements_clause');
        if (implementsNode) {
            implementsList = implementsNode.children()
                .filter(c => c.isNamed() && c.kind() !== 'implements')
                .map(c => c.text());
        }
    }
    const cls = {
        name: nameNode?.text() ?? 'Unknown',
        methods: [],
        properties: [],
        exported,
        line: node.range().start.line + 1,
        description: jsDoc,
        extends: extendsClause,
        implements: implementsList,
    };
    if (body) {
        for (const member of body.children()) {
            const mk = member.kind();
            if (mk === 'method_definition') {
                const methodName = findNamedChild(member, 'property_identifier')?.text() ?? 'unknown';
                const paramsNode = findNamedChild(member, 'formal_parameters');
                const methodJSDoc = getJSDocFromPrev(member);
                const params = paramsNode
                    ? paramsNode.children()
                        .filter(c => c.isNamed())
                        .map(c => c.text())
                    : [];
                cls.methods.push({
                    name: methodName,
                    params,
                    returnType: getReturnType(member),
                    description: methodJSDoc,
                });
            }
            else if (mk === 'public_field_definition') {
                const propName = findNamedChild(member, 'property_identifier')?.text();
                const typeAnnotation = findNamedChild(member, 'type_annotation');
                if (propName) {
                    cls.properties.push({
                        name: propName,
                        type: typeAnnotation?.text().replace(/^:\s*/, '').trim(),
                    });
                }
            }
        }
    }
    return cls;
}
function extractInterfaceDecl(node) {
    const nameNode = findNamedChild(node, 'type_identifier');
    const body = findNamedChild(node, 'interface_body') ?? findNamedChild(node, 'object_type');
    const jsDoc = getJSDocFromPrev(node);
    const fields = [];
    if (body) {
        for (const member of body.children()) {
            if (member.kind() === 'property_signature') {
                const propName = findNamedChild(member, 'property_identifier')?.text();
                const typeAnnotation = findNamedChild(member, 'type_annotation');
                const isOptional = member.text().includes('?:') || member.text().includes('? :');
                if (propName && typeAnnotation) {
                    fields.push({
                        name: propName,
                        type: typeAnnotation.text().replace(/^:\s*/, '').trim(),
                        optional: isOptional || undefined,
                    });
                }
            }
            else if (member.kind() === 'method_signature') {
                const methodName = findNamedChild(member, 'property_identifier')?.text();
                if (methodName) {
                    const paramsNode = findNamedChild(member, 'formal_parameters');
                    const returnType = getReturnType(member);
                    const sig = `${methodName}(${paramsNode?.text().replace(/^\(|\)$/g, '') ?? ''})${returnType ? ': ' + returnType : ''}`;
                    fields.push({ name: methodName, type: sig });
                }
            }
        }
    }
    return {
        name: nameNode?.text() ?? 'Unknown',
        kind: 'interface',
        fields: fields.length > 0 ? fields : undefined,
        description: jsDoc,
    };
}
function extractTypeAlias(node) {
    const nameNode = findNamedChild(node, 'type_identifier');
    const jsDoc = getJSDocFromPrev(node);
    // Try to extract union members for type aliases like `type X = 'a' | 'b' | 'c'`
    const valueNode = node.children().find(c => c.isNamed() && c.kind() !== 'type_identifier' && c.kind() !== 'type_parameters');
    let values;
    let fields;
    if (valueNode) {
        if (valueNode.kind() === 'union_type') {
            // Extract union members
            values = extractUnionMembers(valueNode);
        }
        else if (valueNode.kind() === 'object_type') {
            // Type with object shape: type Foo = { bar: string; baz: number }
            fields = [];
            for (const member of valueNode.children()) {
                if (member.kind() === 'property_signature') {
                    const propName = findNamedChild(member, 'property_identifier')?.text();
                    const typeAnnotation = findNamedChild(member, 'type_annotation');
                    const isOptional = member.text().includes('?:');
                    if (propName && typeAnnotation) {
                        fields.push({
                            name: propName,
                            type: typeAnnotation.text().replace(/^:\s*/, '').trim(),
                            optional: isOptional || undefined,
                        });
                    }
                }
            }
            if (fields.length === 0)
                fields = undefined;
        }
    }
    return {
        name: nameNode?.text() ?? 'Unknown',
        kind: 'type',
        values,
        fields,
        description: jsDoc,
    };
}
function extractUnionMembers(node) {
    const members = [];
    for (const child of node.children()) {
        if (child.kind() === 'union_type') {
            // Nested union — flatten
            members.push(...extractUnionMembers(child));
        }
        else if (child.isNamed()) {
            const text = child.text().replace(/^['"]|['"]$/g, '');
            members.push(text);
        }
    }
    return members;
}
function extractEnumDecl(node) {
    const nameNode = findNamedChild(node, 'identifier');
    const body = findNamedChild(node, 'enum_body');
    const jsDoc = getJSDocFromPrev(node);
    const values = [];
    if (body) {
        for (const member of body.children()) {
            if (member.kind() === 'enum_assignment') {
                const propId = findNamedChild(member, 'property_identifier');
                if (propId)
                    values.push(propId.text());
            }
            else if (member.kind() === 'property_identifier') {
                // Enum member without assignment
                values.push(member.text());
            }
        }
    }
    return {
        name: nameNode?.text() ?? 'Unknown',
        kind: 'enum',
        values: values.length > 0 ? values : undefined,
        description: jsDoc,
    };
}
function extractImportStatement(node, result) {
    const sourceNode = findNamedChild(node, 'string');
    if (!sourceNode)
        return;
    const source = sourceNode.text().replace(/^['"]|['"]$/g, '');
    const importClause = findNamedChild(node, 'import_clause');
    if (!importClause)
        return;
    const names = [];
    for (const child of importClause.children()) {
        if (child.kind() === 'identifier') {
            // Default import
            names.push(child.text());
        }
        else if (child.kind() === 'named_imports') {
            for (const spec of findChildren(child, 'import_specifier')) {
                const identifiers = findChildren(spec, 'identifier');
                // Use the local name (last identifier if aliased)
                const localName = identifiers.length > 1 ? identifiers[1].text() : identifiers[0]?.text();
                if (localName)
                    names.push(localName);
            }
        }
        else if (child.kind() === 'namespace_import') {
            const id = findNamedChild(child, 'identifier');
            if (id)
                names.push(`* as ${id.text()}`);
        }
    }
    result.imports.push({ source, names });
}
// ─── Regex-based extractors for unsupported languages ───
function extractPython(content) {
    const lines = content.split('\n');
    const functions = [];
    const classes = [];
    const imports = [];
    const variables = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // Docstring helper: check next line(s) for triple-quote docstring
        const getDocstring = (startIdx) => {
            for (let j = startIdx + 1; j < Math.min(startIdx + 5, lines.length); j++) {
                const dLine = lines[j].trim();
                if (dLine.startsWith('"""') || dLine.startsWith("'''")) {
                    const quote = dLine.substring(0, 3);
                    if (dLine.endsWith(quote) && dLine.length > 6) {
                        return dLine.slice(3, -3).trim();
                    }
                    // Multi-line docstring
                    let doc = dLine.slice(3);
                    for (let k = j + 1; k < Math.min(j + 20, lines.length); k++) {
                        if (lines[k].trim().endsWith(quote)) {
                            doc += ' ' + lines[k].trim().slice(0, -3);
                            return doc.trim();
                        }
                        doc += ' ' + lines[k].trim();
                    }
                    return doc.trim();
                }
                if (dLine.length > 0)
                    break;
            }
            return undefined;
        };
        // from module import X, Y
        const fromImportMatch = line.match(/^from\s+(\S+)\s+import\s+(.+)/);
        if (fromImportMatch) {
            const names = fromImportMatch[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
            imports.push({ source: fromImportMatch[1], names });
            continue;
        }
        // import module
        const importMatch = line.match(/^import\s+(\S+)/);
        if (importMatch) {
            imports.push({ source: importMatch[1], names: [importMatch[1]] });
            continue;
        }
        // def function_name(params):
        const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?/);
        if (defMatch) {
            const indent = defMatch[1].length;
            const isMethod = indent > 0;
            const isAsync = line.trim().startsWith('async');
            if (!isMethod) {
                const params = defMatch[3].split(',').map(s => {
                    const [name, type] = s.trim().split(':').map(t => t.trim());
                    return { name, type: type || undefined };
                }).filter(p => p.name && p.name !== 'self');
                functions.push({
                    name: defMatch[2], params, returnType: defMatch[4],
                    exported: !defMatch[2].startsWith('_'), line: lineNum,
                    description: getDocstring(i), isAsync,
                });
            }
            continue;
        }
        // class ClassName:
        const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]*)\))?:/);
        if (classMatch) {
            const classDef = {
                name: classMatch[1], methods: [], properties: [],
                exported: !classMatch[1].startsWith('_'), line: lineNum,
                description: getDocstring(i),
                extends: classMatch[2]?.split(',')[0]?.trim(),
            };
            for (let j = i + 1; j < Math.min(i + 200, lines.length); j++) {
                const memberLine = lines[j];
                if (memberLine.match(/^\S/) && j > i + 1)
                    break;
                const methodMatch = memberLine.match(/^\s+(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?/);
                if (methodMatch) {
                    const params = methodMatch[2].split(',').map(s => s.trim()).filter(s => s && s !== 'self' && s !== 'cls');
                    classDef.methods.push({
                        name: methodMatch[1], params, returnType: methodMatch[3],
                        description: getDocstring(j),
                    });
                }
            }
            classes.push(classDef);
        }
        // Module-level variable: NAME = value or name: type = value
        if (i > 0 || !line.startsWith('#')) {
            const varMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*(?::\s*(\S+))?\s*=\s*(.+)/);
            if (varMatch) {
                const val = varMatch[3].trim();
                variables.push({
                    name: varMatch[1], type: varMatch[2], kind: 'const',
                    value: val.length > 80 ? val.substring(0, 77) + '...' : val,
                    exported: true, line: lineNum,
                });
            }
        }
    }
    return { functions, classes, variables, exports: [], imports, types: [] };
}
function extractGo(content) {
    const lines = content.split('\n');
    const functions = [];
    const classes = [];
    const imports = [];
    const types = [];
    const variables = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // Get preceding comment
        const getComment = () => {
            if (i > 0 && lines[i - 1].trim().startsWith('//')) {
                return lines[i - 1].trim().replace(/^\/\/\s*/, '');
            }
            return undefined;
        };
        const singleImportMatch = line.match(/^import\s+"([^"]+)"/);
        if (singleImportMatch) {
            imports.push({ source: singleImportMatch[1], names: [path.basename(singleImportMatch[1])] });
            continue;
        }
        const funcMatch = line.match(/^func\s+(?:\(\s*\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s+(.+?))?(?:\s*\{|$)/);
        if (funcMatch) {
            const receiver = funcMatch[1];
            const name = funcMatch[2];
            const params = funcMatch[3].split(',').map(s => {
                const parts = s.trim().split(/\s+/);
                return { name: parts[0] ?? '', type: parts.slice(1).join(' ') || undefined };
            }).filter(p => p.name);
            const comment = getComment();
            if (receiver) {
                let cls = classes.find(c => c.name === receiver);
                if (!cls) {
                    cls = { name: receiver, methods: [], properties: [], exported: receiver[0] === receiver[0].toUpperCase(), line: lineNum };
                    classes.push(cls);
                }
                cls.methods.push({ name, params: params.map(p => p.name), returnType: funcMatch[4], description: comment });
            }
            else {
                functions.push({
                    name, params, returnType: funcMatch[4],
                    exported: name[0] === name[0].toUpperCase(), line: lineNum,
                    description: comment,
                });
            }
            continue;
        }
        const structMatch = line.match(/^type\s+(\w+)\s+struct/);
        if (structMatch) {
            const existing = classes.find(c => c.name === structMatch[1]);
            if (!existing) {
                const cls = {
                    name: structMatch[1], methods: [], properties: [],
                    exported: structMatch[1][0] === structMatch[1][0].toUpperCase(),
                    line: lineNum, description: getComment(),
                };
                // Extract struct fields
                for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
                    if (lines[j].trim() === '}')
                        break;
                    const fieldMatch = lines[j].match(/^\s+(\w+)\s+(\S+)/);
                    if (fieldMatch) {
                        cls.properties.push({ name: fieldMatch[1], type: fieldMatch[2] });
                    }
                }
                classes.push(cls);
            }
            types.push({ name: structMatch[1], kind: 'type', description: getComment() });
            continue;
        }
        const ifaceMatch = line.match(/^type\s+(\w+)\s+interface/);
        if (ifaceMatch) {
            const td = { name: ifaceMatch[1], kind: 'interface', description: getComment() };
            const fields = [];
            for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
                if (lines[j].trim() === '}')
                    break;
                const methodSig = lines[j].match(/^\s+(\w+)\s*\(([^)]*)\)\s*(.*)/);
                if (methodSig) {
                    fields.push({ name: methodSig[1], type: `(${methodSig[2]}) ${methodSig[3]}`.trim() });
                }
            }
            if (fields.length > 0)
                td.fields = fields;
            types.push(td);
        }
        // Package-level var/const
        const varMatch = line.match(/^(?:var|const)\s+(\w+)\s+(\S+)\s*=\s*(.+)/);
        if (varMatch) {
            variables.push({
                name: varMatch[1], type: varMatch[2], kind: 'const',
                value: varMatch[3].trim().substring(0, 80),
                exported: varMatch[1][0] === varMatch[1][0].toUpperCase(),
                line: lineNum,
            });
        }
    }
    return { functions, classes, variables, exports: [], imports, types };
}
// ─── File Indexing ───
function indexFile(filePath, rootPath) {
    const ext = path.extname(filePath).toLowerCase();
    const language = INDEXABLE_EXTENSIONS[ext];
    if (!language)
        return null;
    let content;
    try {
        const stat = fs.statSync(filePath);
        if (stat.size > 500_000)
            return null; // Skip files > 500KB
        content = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    const relativePath = path.relative(rootPath, filePath);
    let extracted;
    // Use AST for TypeScript/JavaScript, regex for others
    const astLang = getAstLang(ext);
    if (astLang) {
        try {
            extracted = extractWithAST(content, ext);
        }
        catch {
            // Fallback: return minimal info if AST parse fails
            extracted = { functions: [], classes: [], variables: [], exports: [], imports: [], types: [] };
        }
    }
    else if (language === 'Python') {
        extracted = extractPython(content);
    }
    else if (language === 'Go') {
        extracted = extractGo(content);
    }
    else {
        // For unsupported languages, return basic file info
        extracted = { functions: [], classes: [], variables: [], exports: [], imports: [], types: [] };
    }
    return {
        path: relativePath,
        size: content.length,
        language,
        description: extracted.description,
        functions: extracted.functions,
        classes: extracted.classes,
        variables: extracted.variables,
        exports: extracted.exports,
        imports: extracted.imports,
        types: extracted.types,
    };
}
function walkAndIndex(rootPath) {
    const results = [];
    function walk(dirPath) {
        let items;
        try {
            items = fs.readdirSync(dirPath, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                if (SKIP_DIRS.has(item.name))
                    continue;
                walk(fullPath);
            }
            else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (INDEXABLE_EXTENSIONS[ext]) {
                    const fileIndex = indexFile(fullPath, rootPath);
                    if (fileIndex)
                        results.push(fileIndex);
                }
            }
        }
    }
    walk(rootPath);
    return results;
}
// ─── MCP Tool Registration ───
export function registerIndexer(server) {
    server.tool('index_project', 'Build a rich code index using AST parsing: extracts functions (with JSDoc, params, inner functions), classes, interfaces with fields, enums with values, variables, imports/exports. Writes to .weaver/index.json. Run after read_project.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
    }, async ({ workspacePath }) => {
        if (!fs.existsSync(workspacePath)) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Path does not exist: ${workspacePath}` }) }],
            };
        }
        const manager = new BoardManager(workspacePath);
        const fileIndexes = walkAndIndex(workspacePath);
        const languages = [...new Set(fileIndexes.map(f => f.language))];
        const totalFunctions = fileIndexes.reduce((sum, f) => sum + f.functions.length, 0);
        const totalClasses = fileIndexes.reduce((sum, f) => sum + f.classes.length, 0);
        const totalVariables = fileIndexes.reduce((sum, f) => sum + f.variables.length, 0);
        const totalTypes = fileIndexes.reduce((sum, f) => sum + f.types.length, 0);
        const fileTree = fileIndexes.map(f => ({ path: f.path, size: f.size, type: 'file' }));
        const projectIndex = {
            version: '2.0.0',
            indexedAt: new Date().toISOString(),
            rootPath: workspacePath,
            techStack: languages,
            fileTree,
            files: fileIndexes,
            totalFiles: fileIndexes.length,
            totalFunctions,
            totalClasses,
            totalVariables,
            totalTypes,
        };
        if (manager.exists()) {
            manager.writeIndex(projectIndex);
            manager.logEvent({
                level: 'info',
                agent: 'architect',
                stage: 'read',
                action: 'project_indexed',
                message: `Indexed ${fileIndexes.length} files: ${totalFunctions} functions, ${totalClasses} classes, ${totalVariables} variables, ${totalTypes} types`,
                data: { totalFiles: fileIndexes.length, totalFunctions, totalClasses, totalVariables, totalTypes, languages },
            });
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Indexed ${fileIndexes.length} files with ${totalFunctions} functions, ${totalClasses} classes, ${totalVariables} variables, ${totalTypes} types`,
                        summary: {
                            totalFiles: fileIndexes.length,
                            totalFunctions,
                            totalClasses,
                            totalVariables,
                            totalTypes,
                            languages,
                            topFiles: fileIndexes
                                .sort((a, b) => (b.functions.length + b.classes.length + b.types.length) -
                                (a.functions.length + a.classes.length + a.types.length))
                                .slice(0, 10)
                                .map(f => ({
                                path: f.path,
                                functions: f.functions.map(fn => fn.name),
                                classes: f.classes.map(c => c.name),
                                types: f.types.map(t => `${t.kind}:${t.name}`),
                                variables: f.variables.map(v => v.name),
                            })),
                        },
                    }),
                }],
        };
    });
    server.tool('get_project_index', 'Query the code index built by index_project. Search for functions, classes, interfaces, types, variables by file path, language, or name query. Returns rich data including JSDoc descriptions, interface fields, enum values.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        filePath: z.string().optional().describe('Filter by specific file path (relative to workspace)'),
        language: z.string().optional().describe('Filter by language (e.g., "TypeScript", "Python")'),
        query: z.string().optional().describe('Search function/class/type/variable names containing this string'),
        includeImports: z.boolean().optional().describe('Include import data in results (default: false, saves tokens)'),
        includeVariables: z.boolean().optional().describe('Include variable declarations in results (default: false, saves tokens)'),
    }, async ({ workspacePath, filePath, language, query, includeImports, includeVariables }) => {
        const manager = new BoardManager(workspacePath);
        if (!manager.exists()) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: 'Project not initialized.' }) }],
            };
        }
        const index = manager.readIndex();
        if (!index) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: 'No index found. Run index_project first to build the code index.',
                        }),
                    }],
            };
        }
        let results = index.files;
        if (filePath) {
            results = results.filter(f => f.path.includes(filePath));
        }
        if (language) {
            results = results.filter(f => f.language.toLowerCase() === language.toLowerCase());
        }
        if (query) {
            const q = query.toLowerCase();
            results = results.filter(f => f.functions.some(fn => fn.name.toLowerCase().includes(q)) ||
                f.classes.some(cls => cls.name.toLowerCase().includes(q)) ||
                f.types.some(t => t.name.toLowerCase().includes(q)) ||
                f.variables.some(v => v.name.toLowerCase().includes(q)) ||
                f.exports.some(e => e.toLowerCase().includes(q)));
        }
        const output = results.map(f => {
            const base = {
                path: f.path,
                language: f.language,
                description: f.description,
                functions: f.functions,
                classes: f.classes,
                exports: f.exports,
                types: f.types,
            };
            if (includeImports)
                base.imports = f.imports;
            if (includeVariables)
                base.variables = f.variables;
            return base;
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        indexedAt: index.indexedAt,
                        totalIndexedFiles: index.totalFiles,
                        matchedFiles: output.length,
                        results: output.slice(0, 30),
                        truncated: output.length > 30,
                    }),
                }],
        };
    });
}
//# sourceMappingURL=indexer.js.map