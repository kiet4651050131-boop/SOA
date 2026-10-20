// Sinh tài liệu OpenAPI 3 (hợp đồng dịch vụ) từ mô tả route ngắn gọn.
function build({ title, version = '1.0.0', description = '', routes = [] }) {
    const paths = {};
    for (const r of routes) {
        const p = r.path.replace(/:([A-Za-z]+)/g, '{$1}');
        const parameters = [...r.path.matchAll(/:([A-Za-z]+)/g)].map((m) => ({
            name: m[1], in: 'path', required: true, schema: { type: 'string' }
        }));
        (r.query || []).forEach((q) => parameters.push({ name: q, in: 'query', schema: { type: 'string' } }));

        const op = {
            summary: r.summary,
            tags: [title],
            parameters,
            responses: {
                200: { description: 'Thành công' },
                400: { description: 'Dữ liệu không hợp lệ' },
                ...(r.auth === false ? {} : { 401: { description: 'Chưa đăng nhập / token hết hạn' } }),
                ...((r.roles && !r.roles.includes('*')) ? { 403: { description: 'Không đủ quyền' } } : {}),
                ...(p.includes('{') ? { 404: { description: 'Không tìm thấy' } } : {}),
                ...(r.method === 'POST' ? { 409: { description: 'Dữ liệu bị trùng / vi phạm quy tắc nghiệp vụ' } } : {}),
                503: { description: 'Dịch vụ phụ thuộc tạm thời không khả dụng' }
            },
            'x-roles': r.roles || ['*'],
            security: r.auth === false ? [] : [{ bearerAuth: [] }]
        };
        if (r.body) {
            op.requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: r.required || [],
                            properties: Object.fromEntries(r.body.map((f) => [f, {
                                type: (r.types && r.types[f]) || 'string',
                                ...(r.enums && r.enums[f] ? { enum: r.enums[f] } : {})
                            }]))
                        }
                    }
                }
            };
        }
        paths[p] = paths[p] || {};
        paths[p][r.method.toLowerCase()] = op;
    }
    return {
        openapi: '3.0.3',
        info: { title, version, description },
        paths,
        components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
    };
}

module.exports = { build };
