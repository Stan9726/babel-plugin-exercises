const { declare } = require('@babel/helper-plugin-utils');

/**
 * 将 AST 类型节点解析为字符串类型
 * @param {Object} targetType - AST 类型节点（如 TSTypeAnnotation, TSTypeReference 等）
 * @param {Object} typeParamMap - 泛型参数映射表，用于替换泛型 T -> 具体类型
 * @param {Object} scope - 作用域对象，用于查找类型别名
 * @returns {string|undefined} 解析后的类型字符串，如 'string', 'number'，或 undefined
 */
const resolveType = (targetType, typeParamMap = {}, scope) => {
    if (!targetType) return;

    // TypeScript 关键字到字符串类型的映射
    const tsTypeMap = {
        TSStringKeyword: 'string',
        TSNumberKeyword: 'number',
        TSBooleanKeyword: 'boolean',
        NumberTypeAnnotation: 'number', // Flow 类型
        StringTypeAnnotation: 'string',
        BooleanTypeAnnotation: 'boolean',
    };

    switch (targetType.type) {
        // 处理带类型注解的情况，如: let x: string
        case 'TSTypeAnnotation':
            // 如果是类型引用（如泛型），从映射表中查找
            if (targetType.typeAnnotation.type === 'TSTypeReference') {
                return typeParamMap[targetType.typeAnnotation.typeName.name];
            }
            return tsTypeMap[targetType.typeAnnotation.type];
        // 基本类型关键字
        case 'TSNumberKeyword':
        case 'NumberTypeAnnotation':
            return 'number';
        case 'TSStringKeyword':
        case 'StringTypeAnnotation':
            return 'string';
        case 'TSBooleanKeyword':
        case 'BooleanTypeAnnotation':
            return 'boolean';
        // 字面量类型，如: type A = 'hello'
        case 'TSLiteralType':
            return targetType.literal.value;
        // 类型引用，支持泛型参数替换和类型别名
        case 'TSTypeReference':
            // 1. 首先检查是否是泛型参数映射（如 T -> number）
            if (typeParamMap[targetType.typeName.name]) {
                return typeParamMap[targetType.typeName.name];
            }
            // 2. 查找类型别名（如 type Res<T> = ...）
            const typeAlias = scope.getData(targetType.typeName.name);
            if (!typeAlias?.body) return;

            // 3. 解析类型别名的类型参数（如 Res<number> 中的 number）
            const paramTypes =
                targetType.typeParameters?.params.map((param) =>
                    resolveType(param, typeParamMap, scope)
                ) || [];
            // 4. 建立参数映射（如 Param -> number）
            const params = typeAlias.paramNames.reduce((obj, name, index) => {
                obj[name] = paramTypes[index];
                return obj;
            }, {});

            // 5. 求值类型别名体（如 type Res<Param> = Param extends 1 ? number : string）
            return typeEval(typeAlias.body, params, typeParamMap, scope);
    }
};

/**
 * 求值条件类型（Conditional Type）
 * 如: type Res<T> = T extends 1 ? number : string
 * @param {Object} node - TS Conditional Type 节点
 * @param {Object} params - 类型参数映射
 * @param {Object} typeParamMap - 泛型参数映射
 * @param {Object} scope - 作用域
 */
const typeEval = (node, params, typeParamMap, scope) => {
    // 解析 checkType（extends 前的类型）
    let checkType;
    if (node.checkType.type === 'TSTypeReference') {
        checkType = params[node.checkType.typeName.name];
    } else {
        checkType = resolveType(node.checkType, typeParamMap, scope);
    }

    // 解析 extendsType（extends 后的类型）
    const extendsType = resolveType(node.extendsType, typeParamMap, scope);

    // 根据条件判断返回 trueType 还是 falseType
    return resolveType(
        checkType === extendsType || checkType instanceof extendsType
            ? node.trueType
            : node.falseType,
        typeParamMap,
        scope
    );
};

/**
 * 辅助函数：收集类型错误
 * 使用 stackTraceLimit=0 减少不必要的错误堆栈输出
 */
const pushError = (errors, path, message) => {
    const tmp = Error.stackTraceLimit;
    Error.stackTraceLimit = 0;
    errors.push(path.buildCodeFrameError(message, Error));
    Error.stackTraceLimit = tmp;
};

const typeChecker = declare((api, options) => {
    api.assertVersion(7);

    return {
        pre: (file) => {
            // 初始化：错误收集器
            file.set('typeCheckErrors', []);
        },

        visitor: {
            /**
             * 收集类型别名声明
             * 将类型别名存储到 scope 中，供后续类型引用时查找
             * 例如: type Res<T> = T extends 1 ? number : string
             */
            TSTypeAliasDeclaration: (path) => {
                path.scope.setData(path.get('id').toString(), {
                    // 泛型参数名列表，如 ['Param']
                    paramNames: path.node.typeParameters?.params.map((p) => p.name) || [],
                    // 类型别名的 AST 节点，用于后续求值
                    body: path.getTypeAnnotation(),
                });
            },

            /**
             * 变量声明类型检查
             * 检查: let x: string = 123
             * 预期: 报错 - number 不能赋值给 string
             */
            VariableDeclarator: (path, state) => {
                const errors = state.file.get('typeCheckErrors');
                const idType = path.get('id').getTypeAnnotation();
                const initType = path.get('init').getTypeAnnotation();

                // 跳过没有类型注解的情况
                if (!idType || !initType) return;

                // 解析类型为字符串
                const idResolved = resolveType(idType, {}, path.scope);
                const initResolved = resolveType(initType, {}, path.scope);

                // 比较类型是否匹配
                if (idResolved && initResolved && idResolved !== initResolved) {
                    pushError(
                        errors,
                        path.get('init'),
                        `Type '${initResolved}' cannot be assigned to type '${idResolved}'`
                    );
                }
            },

            /**
             * 函数调用类型检查
             * 检查: 函数参数类型、参数个数、泛型类型参数
             * 例如: add<number>(1, '2')
             */
            CallExpression: (path, state) => {
                const errors = state.file.get('typeCheckErrors');

                // 获取被调用函数的绑定信息
                const binding = path.scope.getBinding(path.get('callee').toString());
                if (!binding) return;

                const fnPath = binding.path;

                // 1. 解析调用处的泛型类型参数
                // 如: add<number>(...) 中的 number
                const callTypeParams = path.node.typeParameters;
                const realTypes =
                    callTypeParams?.params.map((p) => resolveType(p, {}, path.scope)) || [];

                // 2. 建立泛型参数映射: T -> number
                // 将函数定义的泛型参数映射到调用时的具体类型
                const typeParamMap = {};
                fnPath.node.typeParameters?.params.forEach((param, i) => {
                    if (realTypes[i]) typeParamMap[param.name] = realTypes[i];
                });

                // 3. 获取调用时传入的参数类型
                const argTypes = path.get('arguments').map((arg) => {
                    const t = arg.getTypeAnnotation();
                    return t ? resolveType(t, typeParamMap, path.scope) : 'unknown';
                });

                // 4. 获取函数定义的参数类型
                const paramTypes = fnPath.get('params').map((param) => {
                    const t = param.getTypeAnnotation();
                    return t ? resolveType(t, typeParamMap, fnPath.scope) : 'unknown';
                });

                // 5. 检查参数个数是否匹配
                if (argTypes.length !== paramTypes.length) {
                    pushError(
                        errors,
                        path,
                        `Expected ${paramTypes.length} arguments, got ${argTypes.length}`
                    );
                    return;
                }

                // 6. 逐个检查参数类型是否匹配
                argTypes.forEach((argType, i) => {
                    if (argType !== paramTypes[i]) {
                        pushError(
                            errors,
                            path.get('arguments.' + i),
                            `Argument type '${argType}' does not match parameter type '${paramTypes[i]}'`
                        );
                    }
                });
            },

            /**
             * override 修饰符检查
             * 检查标记为 override 的方法是否在父类中存在
             * 例如: override foo() {} - 如果 Parent 没有 foo 方法则报错
             */
            ClassDeclaration: (path, state) => {
                const errors = state.file.get('typeCheckErrors');
                const superClass = path.node.superClass;
                if (!superClass) return;

                // 获取父类的绑定信息
                const superBinding = path.scope.getBinding(superClass.name);
                if (!superBinding) return;

                // 收集父类所有方法名
                const superMethodNames = new Set();
                superBinding.path.traverse({
                    ClassMethod(p) {
                        superMethodNames.add(p.get('key').toString());
                    },
                });

                // 遍历当前类的方法，检查 override 标记
                path.traverse({
                    ClassMethod(childPath) {
                        // 只检查带有 override 标记的方法
                        if (!childPath.node.override) return;

                        const methodName = childPath.get('key').toString();
                        // 如果父类中没有这个方法，报错
                        if (!superMethodNames.has(methodName)) {
                            pushError(
                                errors,
                                childPath.get('key'),
                                `Method '${methodName}' marked with override but does not exist in superclass`
                            );
                        }
                    },
                });
            },
        },

        post: (file) => {
            const errors = file.get('typeCheckErrors');
            if (errors.length > 0 && options?.onResult) {
                // 输出收集到的错误
                options.onResult(errors);
            }
        },
    };
});

module.exports = typeChecker;
