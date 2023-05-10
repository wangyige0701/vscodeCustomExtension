/**
 * 对字符串进行正则校验
 * @param str {String} 验证字符串
 * @param reg {RegExp} 正则校验，默认非换行符的任意多字符
 * @returns 校验结果
 */
export function check (str: string, reg: RegExp = /^.*$/): boolean {
    return reg.test(str);
}

/**
 * 根据日期数据生成格式化日期字符串
 * @param date {Date} 日期
 * @param format {String} 时间内容展示格式
 * @returns 格式化日期字符串
 */
export function getDate(date: Date | undefined = undefined, format: string = "YYYY-MM-DD hh:mm:ss"): string {
    let legal = '[^a-zA-Z0-9\\n\\f\\r\\t\\v]'; // 合法连接符
    let reg = new RegExp(`^YYYY(${legal}{1})MM(${legal}{1})DD(${legal}{1})hh(${legal}{1})mm(${legal}{1})ss$`);
    // 校验时间格式
    if (!format || !check(format, reg)) throw new Error("时间格式错误");
    // 判断是否传入日期
    if (date === undefined) date = new Date();
    const formatCode = format.match(reg)?.slice(1, 6);
    // 获取时间连接符
    const [f1, f2, f3, f4, f5] = formatCode!;
    let y = date.getFullYear();
    let m = addZero(date.getMonth() + 1);
    let d = addZero(date.getDate());
    let h = addZero(date.getHours());
    let mm = addZero(date.getMinutes());
    let s = addZero(date.getSeconds());
    return `${y}${f1}${m}${f2}${d}${f3}${h}${f4}${mm}${f5}${s}`;
}

/**
 * 对数字进行补位
 * @param value 补位的数字
 * @param length 期望的长度
 * @returns 补齐的数字字符串
 */
export function addZero (value: number | string, length: number = 2): string {
    value = value.toString();
    let left = value.split('.')[0];
    if (left.length < length) {
        for (let i of range(length - left.length)) {
            value = '0' + value;
        }
    }
    return value;
}

/**
 * 迭代器循环数字范围
 */
export function *range (end: number, start: number = 0, step: number = 1) {
    for (let i = start; i < end; i += step) {
        yield i;
    }
}

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

/**
 * 生成一个指定长度的哈希序列，默认24位
 * @param {Number|String} length 生成哈希字符串的长度
 * @returns 返回一个哈希序列
 */
export function getHashCode (length: number | string = 24): string {
    let str: string = '';
    length = Number(length) || 24 as number;
    for (let i: number = 0; i < length; i++) {
        str += Math.floor(Math.random() * 36).toString(36);
    }
    return str;
}

export function isString (value: any): boolean {
    return typeof value === 'string';
}

export function isNumber (value: any): boolean {
    return typeof value === 'number';
}

export function isArray (value: any): boolean {
    return Array.isArray(value);
}

export function isNull (value: any): boolean {
    return value === null;
}

export function isObject (value: any):boolean {
    return typeof value === 'object' && !isArray(value) && !isNull(value);
}

export function isUndefinded (value: any): boolean {
    return typeof value === 'undefined';
}