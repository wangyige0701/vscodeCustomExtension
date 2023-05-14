/* index(2) */

const inputInfo = {
    box: 'infoInput', // 输入框容器id
    id: 'inputValue', // 输入框id
    selectionContainer: '.icon-container.input-change-icon',
    selection: '.icon-container.input-change-icon>.iconfont',
    operation: '.icon-container.input-button>.iconfont',
    confirm: 'confirm', // 确认按钮id
    confirmLock: 'lock',
    clear: 'clear', // 清除按钮id
    select: 'select', // 输入框选项选中样式类名
    focus: 'focus', // 输入框聚焦容器样式类名
    warn: 'warning', // 输入框警告样式类名
    warnInfo: 'inputWarning', // 警告信息容器id
    inputPlaceholder: ['外部图片地址（https/http）', '透明度（0.1~1）当前为'], // 占位符内容
    inputType: ['text', 'number'],
    selectionIcon: [{
        icon: iconCode.image,
        title: '上传外部图片'
    }, {
        icon: iconCode.opacity,
        title: '设置透明度' 
    }],
    match: [{
        regexp: /^https|http\:\/\/[.]+\.gif|png|jpg|jpeg|webp(\?(([.]+)=([.]+))?){0,1}$/,
        message: '网络图片路径格式不正确'
    }, {
        regexp: /^(1)$|^(0\.[1-9]+([0-9]*[1-9])?)$/,
        message: '只能输入0.1~1的数字'
    }],
}

// 输入框事件绑定
const inputDataWatcher = createInputEvent();

// 注册输入框确认按钮锁
registLock('inputConfirm', inputConfirmButtonLock);

function createInputEvent () {
    createInputSelection(document.querySelector(inputInfo.selectionContainer));
    // 输入框类型控制按钮列表
    const selection = document.querySelectorAll(inputInfo.selection);
    // 输入框操作按钮
    let operation = document.querySelectorAll(inputInfo.operation);
    // 输入框的外层盒子
    const box = getId(inputInfo.box);
    // 输入框对象
    const inputTarget = getId(inputInfo.id);
    // 确认按钮
    let confirm = getId(inputInfo.confirm);
    // 清除按钮
    let clear = getId(inputInfo.clear);

    let type = undefined, value = '';
    let inputDataWatcher = Object.defineProperties({}, {
        type: {
            // 0是上传外部图片；1是修改透明度
            enumerable: true,
            configurable: true,
            set (newValue) {
                if (newValue !== type && newValue < inputInfo.inputPlaceholder.length) {
                    type = newValue;
                    this.value = "";
                    setAllAttribute(inputTarget, {
                        placeholder: inputInfo.inputPlaceholder[type] + (type === 1 ? publicData.backgroundOpacity : ''),
                        'data-type': inputInfo.inputType[type]
                    });
                    inputSelectionClass(selection, type);
                }
            },
            get () {
                return type;
            }
        },
        value: {
            // 缓存输入框数据
            enumerable: true,
            configurable: true,
            set (newValue) {
                // 输入框只限制text类型，数字校验手动进行，数字类型输入框删除加减按钮失败
                if (typeof newValue === 'string') {
                    if (newValue && typeof this.type === 'number' && 
                    inputInfo.inputType[this.type] === 'number' && 
                    (!newValue.match(/^(?!\.)/) || 
                    (newValue.match(/\./g) && newValue.match(/\./g).length > 1))) {
                        // 数字校验，number类型转换float类型后不能为NaN，小数点不能出现在开头并且不能出现两个以上
                        value = isNaN(parseFloat(newValue)) ? value : String(parseFloat(newValue));
                    } else {
                        value = newValue;
                    }
                    inputStartCheck(this.type, value);
                    inputTarget.value = value;
                }
            },
            get () {
                return value;
            }
        }
    });
    // 占位符初始赋值
    inputDataWatcher.type = 0;
    // 文本框输入更新对象属性
    inputTarget.oninput = function ({ target: { value } }) {
        inputDataWatcher.value = value;
    }
    inputTarget.onfocus = function () {
        box.classList.add(inputInfo.focus);
    }
    inputTarget.onblur = function () {
        box.classList.remove(inputInfo.focus);
    }
    // 回车
    inputTarget.onkeydown = function ({ code }) {
        if (code === 'Enter') {
            inputSendInfo.call(inputDataWatcher);
        }
    }
    // 清除按钮
    clear.onclick = function () {
        inputDataWatcher.value = "";
    }
    // 确认按钮
    confirm.onclick = inputSendInfo.bind(inputDataWatcher);
    // 切换按钮绑定
    selection.forEach((item, index) => {
        item.onclick = function () {
            inputDataWatcher.type = index;
            inputDataWatcher.value = "";
        }
    });
    // 输入框操作按钮统一方法
    operation.forEach(item => {
        // 统一阻止冒泡
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (lockSet.inputConfirm) return;
            inputTarget.focus();
        });
    });
    // 内存占用释放
    operation = null;confirm = null;clear = null;

    return inputDataWatcher;
}

/**
 * 选项按钮创建并插入元素
 * @param {HTMLElement} target 
 */
function createInputSelection (target) {
    inputInfo.selectionIcon.forEach(item => {
        let element = createELement('span', {
            title: item.title??'',
            class: 'iconfont'
        });
        element.innerHTML = item.icon??'';
        target.appendChild(element);
        element = null;
    });
}

/**
 * 对输入框输入内容进行校验
 * @param {number} index 当前选项
 * @param {string} value 被校验的数据
 * @param {boolean} empty 是否需要校验空值
 */
function inputStartCheck (index, value, empty=false) {
    let box = getId(inputInfo.box);
    let reg = inputInfo.match[index];
    let state;
    if (reg && (value || (!value && empty))) {
        state = inputWarnignState(box, reg.message, !getRegExpContent(reg.regexp).test(value));
    } else {
        state = inputWarnignState(box, '', false);
    }
    reg = null;box = null;
    return state;
}

/**
 * 警告信息
 * @param {HTMLElement} target 
 * @param {string} message 
 * @param {boolean} state 
 */
function inputWarnignState (target, message, state = false) {
    // state为false删除警告类名，为true添加类名
    let warn = getId(inputInfo.warnInfo);
    if (state) {
        target.classList.add(inputInfo.warn);
        warn.innerText = message;
    } else {
        target.classList.remove(inputInfo.warn);
        warn.innerText = "";
    }
    warn = null;
    return state;
}

/**
 * 获取正则表达式
 * @param {string|RegExp} data 
 * @returns {RegExp}
 */
function getRegExpContent (data) {
    if (typeof data === 'string') {
        return new RegExp(data);
    }
    return data;
}

/**
 * 发送输入框数据进行处理
 */
function inputSendInfo () {
    if (this.type === 1) backOpacityRange(this);
    if (!canSelect) return;
    if (inputStartCheck(this.type, this.value, true)) return;
    lockSet.inputConfirm = true;
    switch (this.type) {
        case 0:
            // 上传外部图片
            setExternalImage(this.value?.trim());
            break;
        case 1:
            // 设置透明度
            setBackgroundOpacity(parseFloat(this.value));
            break;
        default:
            break;
    }
}

/**
 * 限制透明度范围
 * @param {{type:number,value:string}} target 
 */
function backOpacityRange (target) {
    let val = parseFloat(target.value);
    if (val > 1 || val < 0.1) {
        target.value = String(minmax(0.1, val, 1));
    }
}

/**
 * 发送外部图片地址
 * @param {string} src 
 */
function setExternalImage (src) {
    sendMessage({
        name: 'externalImage',
        value: src
    });
}

/**
 * 发送透明度设置
 * @param {number} opacity 
 */
function setBackgroundOpacity (opacity) {
    sendMessage({
        name: 'backgroundOpacity',
        value: opacity
    });
}

/**
 * 修改元素列表的类名
 * @param {NodeListOf<Element>} ellist 
 * @param {number} index 
 */
function inputSelectionClass (ellist, index) {
    if (index < ellist.length) {
        ellist.forEach((item, i) => {
            if (!item.classList.contains(inputInfo.select)) {
                i === index ? item.classList.add(inputInfo.select) : null;
            } else {
                i === index ? null : item.classList.remove(inputInfo.select);
            }
        });
    }
}

/**
 * 确认加载状态处理
 * @param {boolean} value 
 * @returns 
 */
function inputConfirmButtonLock (value) {
    const icon = getId(inputInfo.confirm);
    if (!icon) return;
    if (value) {
        // 为true上锁，添加加载图标
        icon.innerHTML = iconCode.loadingSingle;
        icon.classList.add(loadingClass, inputInfo.confirmLock);
        getId(inputInfo.clear)?.classList.add(inputInfo.confirmLock);
    } else {
        // 删除加载图标
        icon.innerHTML = iconCode.confirm;
        icon.classList.remove(loadingClass, inputInfo.confirmLock);
        getId(inputInfo.clear)?.classList.remove(inputInfo.confirmLock);
    }
}

/**
 * 清空输入框内容
 */
function inputImageDownloadComplete () {
    inputDataWatcher.value = "";
}