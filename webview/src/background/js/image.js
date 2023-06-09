/* index(3) */

// 监听右键点击，点击图片发送数据查看大图
document.getElementById(listId).addEventListener('contextmenu', (e) => {
    let { target } = e;
    if (!target.classList.contains('image-container') && !target.parentElement.classList.contains('image-container')) return;
    e.preventDefault();
    if (target.parentElement.classList.contains('image-container')) target = target.parentElement;
    // 判断点击的图片是否已经显示大图
    let code = target.dataset?.code??'';
    if (code === nowSelectViewImage) return;
    sendMessage({
        name: 'viewBigImage',
        value: { code, src: target.querySelector('.image')?.getAttribute('src')??'' }
    });
    nowSelectViewImage = code;
});

/**
 * 创建图片列表操作方法实例
 * @returns 
 */
function createInstance () {
    const imageDeleteCLass = 'image-delete';
    class ImageList {
        /**
         * 记录选中的图片元素
         * @type {string[]}
        */
        selectImageList;
        /**
         * 校验是否不显示列表提示文字
         * @type {boolean}
        */
        imageInfoEmpty;
        /**
         * 校验是否不显示加载图标
         * @type {boolean}
        */
        imageInfoLoading;
        /**
         * 当前是否设置了随机切换背景图
        */
        isRandomBackground = false;
        /**
         * 当前设置的随机切换列表
        */
        randomList = [];
        /**
         * 当前设置随机背景按钮的文字内容。
         * 1为取消随机；2为设置勾选的图片，3为设置全部图片
        */
        settingRandomButtonTextState = 3;

        constructor() {
            // 初始化时更新加载状态
            this.changeImageListInfo(true, true);
            /** @type {string} */
            this.id = listId;
            /** @type {HTMLElement} */
            this.element = getId(this.id);
            // 劫持选择列表长度改变
            this.#resetSelectImageList(this);
            // 代理数组双向绑定
            publicData.imageRenderList = new Proxy([], {
                set: this.#set.bind(this),
                get: this.#get.bind(this)
            });
            publicData.imageRenderList.__proto__ = this.#resetMethods(this);
        }

        /**
         * 重置数组的操作方法，将数据和元素操作进行绑定
         * @param {ImageList} _this
         */
        #resetMethods (_this) {
            let methods = ['push', 'pop', 'shift', 'unshift', 'splice'];
            const oldMethods = Array.prototype;
            const newMethods = Object.create(oldMethods);
            methods.forEach(method => {
                newMethods[method] = function (...args) {
                    switch (method) {
                        case 'push':
                        case 'unshift':
                            args.forEach(arg => {
                                if (objectHas(arg, 'src', 'code')) 
                                    arg.target = _this.#addImageItem(arg, method==='unshift'); // 元素对象
                            });
                            break;
                        case 'pop':
                            _this.#deleteImageItem(this[this.length-1].target);
                            break;
                        case 'shift':
                            _this.#deleteImageItem(this[0].target);
                            break;
                        case 'splice':
                            if (args.slice(2).length === 0) 
                                // 只处理通过splice删除元素
                                for (let i = 0; i < args[1]; i++) {
                                    _this.#deleteImageItem(this[args[0]+i].target);
                                }
                            break;
                        default:
                            break;
                    }
                    return oldMethods[method].apply(this, args);
                }
            });
            methods = null;
            return newMethods;
        }

        /**
         * 重写set方法，新增只处理unshift
         */
        #set (target, property, value, receiver) {
            if (property === 'length') {
                // 修改length属性更新索引
                target.forEach((item, index) => {
                    item.index = index;
                });
                // 长度大于0，关闭文字区域
                value > 0 ? 
                    (
                        this.changeImageListInfo(false),
                        getId(selectButtonId)?.setAttribute('title', `${selectButtonText}（已上传${value}张）`)
                    ) : 
                    (
                        this.changeImageListInfo(true),
                        getId(selectButtonId)?.setAttribute('title', selectButtonText)
                    );
            }
            return Reflect.set(target, property, value, receiver);
        }

        /**
         * 重写get方法
         */
        #get (target, property, receiver) {
            return Reflect.get(target, property, receiver);
        }

        /**
         * 获取选中列表长度改变，进行dom更新
         * @param {ImageList} _this
         */
        #resetSelectImageList (_this) {
            this.selectImageList = new Proxy([], {
                set (target, property, value, receiver) {
                    const hasPro = target.hasOwnProperty(property);
                    const oldData = target[property];
                    const res = Reflect.set(target, property, value, receiver);
                    if (!hasPro) {
                        _this.renderBySelectListLength(true);
                    } else if (property === 'length' && oldData !== value) {
                        _this.renderBySelectListLength(false);
                    }
                    if (property === 'length') {
                        // 判断是否需要展示删除按钮
                        const batchButton = $query(
                            `.${batchButtonContainerClass}`
                        );
                        if (value > 0) {
                            batchButton.classList.add(selectButtonToContainerClass);
                        } else {
                            batchButton.classList.remove(selectButtonToContainerClass);
                        }
                        _this.settingRandomButtonText();
                    }
                    return res;
                },
                get (target, property, receiver) {
                    return Reflect.get(target, property, receiver);
                }
            });
        }

        /**
         * 对图片选中数据进行遍历获取数组更新前后状态不同的元素
         * @param {boolean} isAdd 
         */
        renderBySelectListLength (isAdd) {
            const array = [];
            this.getChild()?.forEach(child => {
                if (child.classList.contains(selectButtonToContainerClass)) 
                    array.push(child.dataset[imageContainerCode]);
            });
            let operation, codes = [];
            if (isAdd) {
                // 新增数据
                this.selectImageList.forEach(n => {
                    if (!array.includes(n))
                        codes.push(n);
                });
                operation = 'add';
            } else {
                // 删减数据
                array.forEach(o => {
                    if (!this.selectImageList.includes(o))
                        codes.push(o);
                });
                operation = 'remove';
            }
            this.changeSelectImageIcon(operation, ...codes);
        }

        /**
         * 获取数组格式的选中列表数据
         * @returns {string[]} 
         */
        getSelectListByArray () {
            let array = [];
            this.selectImageList.forEach(item => {
                array.push(item);
            });
            return array;
        }

        /**
         * 根据当前是否已经设置随机切换和勾选的图片数量进行按钮内文字的替换
         */
        settingRandomButtonText () {
            // 切换按钮内文字
            const buttonItem = $query(
                `.${batchButtonContainerClass} #${randomBackId}`
            );
            if (!buttonItem) 
                return;
            const length = this.selectImageList.length;
            if (length > 0) {
                // 勾选图片长度大于0，按钮点击设置随机背景图
                if (this.settingRandomButtonTextState === 2)
                    return;
                buttonItem.innerText = rendomSelectBack;
                this.settingRandomButtonTextState = 2;
            } else {
                // 未勾选则根据当前是否是随机切换背景图的状态显示文字
                if (this.isRandomBackground) {
                    if (this.settingRandomButtonTextState === 1)
                        return;
                    buttonItem.innerText = closeRandom;
                    this.settingRandomButtonTextState = 1;
                } else {
                    if (this.settingRandomButtonTextState === 3)
                        return;
                    buttonItem.innerText = rendomAllBack;
                    this.settingRandomButtonTextState = 3;
                }
            }
            // 设置按钮标题
            getId(randomBackId)?.setAttribute('title', buttonItem.innerText);
        }

        /**
         * 插入一个img节点
         * @param {{code:string,src:string,index:number,target?:HTMLElement}} data 图片数据
         * @param {boolean} head 是否从头部插入，默认为true
         */
        #addImageItem (data, head=true) {
            if (!data) return;
            const { src, code } = data;
            if (!src) return;
            /** 外层容器 @type {HTMLElement} */
            let el = createELement('div', { 
                class: `${listImageClass} ${this.settingRandomButtonTextState === 1 ? imageIsRandomClass : ''}`, 
                [imageContainerCodeName]: code, 
                id: imageContainerCode+'-'+code 
            });
            // 图片本体
            el.appendChild(createELement('img', { class: imageClass, loading: 'lazy', title: '右键查看大图', src }));
            // 操作按钮
            let selectBut, deleteBut;
            el.appendChild(selectBut = createELement('span', { class: imageButtonClass }));
            el.appendChild(deleteBut = createELement('span', { class: imageButtonClass }));
            classListOperation(selectBut, 'add', imageSelectButtonClass, circleBackIconClass);
            classListOperation(deleteBut, 'add', imageDeleteButtonClass, deleteIconClass);
            // 事件绑定
            this.imageSelectIconEventBind(selectBut, false, data);
            this.imageDeleteIconEventBind(deleteBut, false, data);
            this.imageElementEventBind(el, false, data);
            selectBut = null, deleteBut = null;
            // 插入元素
            this.insert.call(this, el, head);
            return el;
        }

        /**
         * 插入元素方法
         * @param {HTMLElement} el
         * @param {boolean} head
         */
        insert (el, head) {
            if (this.element.childNodes.length === 0 || !head) {
                this.element.appendChild(el);
            } else {
                // 在开头插入元素
                this.element.insertBefore(el, this.element.firstChild);
            }
        }

        /**
         * 删除一个图片元素
         * @param {HTMLElement} target 
         */
        #deleteImageItem (target) {
            if (!target) return;
            // 添加删除类名动画
            classListOperation(target, 'add', imageDeleteCLass);
            const selectBut = target.querySelector(
                `.${imageButtonClass}.${imageSelectButtonClass}`
            );
            const deleteBut = target.querySelector(
                `.${imageButtonClass}.${imageDeleteButtonClass}`
            );
            // 解除事件绑定
            this.imageSelectIconEventBind(selectBut, true);
            this.imageDeleteIconEventBind(deleteBut, true);
            this.imageElementEventBind(target, true);
            setTimeout(() => {
                target.remove();
            }, imageAnimationTime);
        }

        /**
         * 根据传入的数组为被选为随机切换的图片添加随机状态类名
         * @param {string[]} array 
         */
        changeImageStyleToRandomSelect (array) {
            if (!this.isRandomBackground || !array) return;
            if (array.length <= 0) {
                // 小于等于0，所有图片全部设置被选中为随机设置
                this.getChild()?.forEach(child => {
                    if (!child.classList.contains(imageIsRandomClass))
                        child.classList.add(imageIsRandomClass);
                });
            } else {
                // 设置传入的数据
                this.deleteAllRandomSelectClass();
                array.forEach(item => {
                    $query(`.${listImageClass}#${imageContainerCode}-${item}`)?.classList.add(imageIsRandomClass);
                });
            }
        }
        
        /**
         * 清除所有图片的随机设置状态类名
         */
        deleteAllRandomSelectClass () {
            this.getChild()?.forEach(child => {
                if (child.classList.contains(imageIsRandomClass))
                    child.classList.remove(imageIsRandomClass);
            });
        }

        /**
         * 对图片列表提示信息进行设置
         * @param {boolean} empty 是否为空
         * @param {boolean} loading 加载状态
         */
        changeImageListInfo (empty=true, loading=false) {
            if (loading !== this.imageInfoLoading) {
                this.imageInfoLoading = loading;
                // 加载状态不同，empty属性相同也可能有不同语句，需要重置状态
                this.imageInfoEmpty = undefined;
                let loadingTarget = $query(imageListInfoIcon);
                if (loading) {
                    // 添加动画
                    classListOperation(loadingTarget, 'add', loadingClass, imageListInfoShowClass);
                    setHtmlText(loadingTarget, 'html', iconCode.loadingSingle);
                } else {
                    classListOperation(loadingTarget, 'remove', loadingClass, imageListInfoShowClass);
                    setHtmlText(loadingTarget, 'html', '');
                }
            }
            if (empty !== this.imageInfoEmpty) {
                this.imageInfoEmpty = empty;
                let infoTarget = $query(imageListInfoContent);
                let containerTarget = getId(imageListInfoId);
                if (empty) {
                    // 数组为空，根据加载情况显示文字
                    classListOperation(containerTarget, 'add', imageListInfoShowClass)
                    setHtmlText(infoTarget, 'text', loading ? imageListInfoEmptyLoading : imageListInfoEmpty);
                } else {
                    // 数组不为空，隐藏文字区域
                    classListOperation(containerTarget, 'remove', imageListInfoShowClass);
                    setHtmlText(infoTarget, 'text', '');
                }
            }
        }

        /**
         * 检查是否有元素
         */
        check () {
            if (!this.element) {
                throw new Error('没有对应元素');
            }
        }

        /**
         * 获取子元素所有节点
         */
        getChild () {
            this.check();
            return this.element.querySelectorAll('.'+listImageClass);
        }

        /**
         * 字节点长度是否满足
         */
        isChildLength (length = 0) {
            this.check();
            return this.getChild().length > length;
        }

        /**
         * 对点击的元素进行选中状态切换，可以传多个数据
         * @param {'add'|'remove'} operation
         * @param {string[]} code 哈希码
         * @returns 
         */
        changeSelectImageIcon (operation, ...codes) {
            if (codes.length <= 0) 
                return;
            codes.forEach(code => {
                const target = $query( 
                    `.${listImageClass}#${imageContainerCode}-${code}`
                );
                const classList = $query( 
                    `.${imageButtonClass}.${imageSelectButtonClass}`,
                    target
                )?.classList;
                if (!classList) 
                    return;
                if (operation === 'add' && !classList.contains(ImageSelectStateClass)) {
                    classList.add(ImageSelectStateClass);
                    target.classList.add(selectButtonToContainerClass);
                } else if (operation === 'remove' && classList.contains(ImageSelectStateClass)) {
                    classList.remove(ImageSelectStateClass);
                    target.classList.remove(selectButtonToContainerClass);
                }
            });
        }

        /**
         * 点击选中图标按钮触发方法
         * @param {string} code 
         */
        clickToChangeSelectImageIcon (code) {
            if (this.selectImageList.includes(code)) {
                const index = this.selectImageList.findIndex(item => item === code);
                this.selectImageList.splice(index, 1);
            } else {
                this.selectImageList.push(code);
            }
        }

        /**
         * 图片选中后的显示状态处理
         * @param {number|string} value 
         */
        imageClickHandle (value) {
            const { select, index } = this.hasSelect();
            if (select) 
                this.cancelSelect(index);
            if (typeof value === 'string') 
                value = this.isCodeContain(value);
            if (index === value) 
                return;
            let target = this.getChild()[value];
            classListOperation(target, 'add', selectClass);
        }

        /**
         * 删除指定位置的select类名
         * @param {number} index 索引
         */
        cancelSelect (index) {
            if (index >= 0) {
                classListOperation(this.getChild()[index], 'remove', selectClass);
            }
        }

        /**
         * 根据哈希码查找元素位置
         * @param {string} code 
         */
        isCodeContain (code) {
            this.check();
            const list = this.getChild();
            let index = -1;
            for (let i = 0; i < list.length; i++) {
                if (this.getCodeValue(list[i]) === code) {
                    index = i;
                    break;
                }
            }
            return index;
        }

        /**
         * 是否有select类名
         * @returns {{select: boolean,index: number}}
         */
        hasSelect () {
            this.check();
            let type = false, index = -1;
            const child = this.getChild();
            for (let i = 0; i < child.length; i++) {
                if (child[i].classList.contains(selectClass)) {
                    index = i;
                    type = true;
                    break;
                }
            }
            return {
                select: type,
                index
            }
        }

        /**
         * 获取编码属性值
         * @param {HTMLElement} el 
         */
        getCodeValue (el) {
            if (el && objectHas(el.dataset, imageContainerCode)) {
                return el.dataset[imageContainerCode];
            }
            return undefined;
        }

        /**
         * 删除图标点击事件处理
         * @param {MouseEvent} e 
         * @returns 
         */
        deleteOneImageIcon (data=undefined, e) {
            e.stopPropagation();
            if (!canChange()) 
                return;
            // 通过哈希码删除
            if (objectHas(data, 'code')) 
                iconClickDeleteImage(data.code);
        }

        /**
         * 选择图标点击事件处理
         * @param {MouseEvent} e 
         * @returns 
         */
        selectOneImageIcon (data=undefined, e) {
            e.stopPropagation();
            if (!canChange()) 
                return;
            // 通过索引设置选中
            if (objectHas(data, 'code')) 
                this.clickToChangeSelectImageIcon(data.code);
        }

        /**
         * 绑定事件处理函数
         * @param {{target:HTMLElement}} param
         */
        imageClick (data=undefined, { target }) {
            if (!canChange()) 
                return;
            if (target.classList.contains(imageClass)) 
                target = target.parentElement;
            if (target.classList.contains(selectClass)) 
                return;
            // 通过哈希码和索引选择背景图
            if (objectHas(data, 'code', 'index'))
                settingBackground({
                    code: data.code,
                    index: data.index
                });
        }

        /**
         * 删除按钮事件绑定
         * @param {HTMLElement} el 
         */
        imageDeleteIconEventBind(el, remove=false, data=undefined) {
            if (!el) return;
            remove ? 
                el.removeEventListener('click', this.deleteOneImageIcon.bind(this)) : 
                el.addEventListener('click', this.deleteOneImageIcon.bind(this, data));
        }
        
        /**
         * 选择按钮事件绑定
         * @param {HTMLElement} el 
         */
        imageSelectIconEventBind(el, remove=false, data=undefined) {
            if (!el) return;
            remove ? 
                el.removeEventListener('click', this.selectOneImageIcon.bind(this)) : 
                el.addEventListener('click', this.selectOneImageIcon.bind(this, data));
        }

        /**
         * 绑定图片点击事件
         * @param {HTMLElement} el 
        */
        imageElementEventBind (el, remove=false, data=undefined) {
            if (!el) return;
            remove ? 
                el.removeEventListener('click', this.imageClick.bind(this)) : 
                el.addEventListener('click', this.imageClick.bind(this, data));
        }
    }

    return new ImageList();
}