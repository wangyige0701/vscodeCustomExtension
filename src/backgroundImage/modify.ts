/**
 * 修改css文件，修改部分包括vscode的源css文件和写入body背景样式的外部css文件
*/

import { dirname, join } from "path";
import { getDate } from "../utils";
import { createBuffer, isFileExits, newUri, readFileUri, uriDelete, writeFileUri } from "../utils/file";
import { backgroundImageConfiguration } from "../workspace/background";
import { Uri, version } from "vscode";
import { changeLoadState, getNewBackgroundOpacity, imageStoreUri, isWindowReloadToLoadBackimage, setBackgroundImageSuccess } from "./utils";
import { getVersion } from "../version";
import { ContentAndUri, info } from "./data";
import { errHandle } from "../error";

/**
 * vscode的源css文件名
 */
const cssName = version >= '1.38' ? 'workbench.desktop.main.css' : 'workbench.main.css';

/**
 * 写背景图样式的外部css文件名
 */
const externalFileName = 'backgroundImageInfo.css';

const tagName = 'wangyige.background'; // 标签名
const tagNameReg = 'wangyige\\.background'; // 标签名正则
const importStart = `/* ${tagName}.start */`; // 开始标签
const importEnd = `/* ${tagName}.end */`; // 结束标签
const importStartMatch = `\\/\\*\\s\*${tagNameReg}\\.start\\s\*\\*\\/`; // 匹配开始标签正则
const importEndMatch = `\\/\\*\\s\*${tagNameReg}\\.end\\s\*\\*\\/`; // 匹配结束标签正则

const s = '\\s\*'; // 任意空格
const a = '\[\\s\\S\]\*'; // 任意字符
const ans = '\\S\*'; // 任意字符不包括空格
const ant = '\.\*'; // 任意字符不包括换行
const asa = '\\S\*\.\*\\S\{1\,\}';// 非空格开头非空格结尾，中间允许有空格，必须以非空格结尾
const n = '\\d\*'; // 任意数字
const w = '\\w\*'; // 任意单词
const nw = '[\\d\\w]\*'; // 任意单词和数字

/**
 * 匹配源及外部css文件修改内容标签范围正则文本，捕获标签中的内容
 */
const findSourceCssPosition = `${importStartMatch}(${a})${importEndMatch}`;
const findSourceCssPositionRegexp = new RegExp(findSourceCssPosition);

/**
 * 捕获源css文件引用文本中的问号后接内容
*/
const findSourceCssVersionContent = 
    `(${importStartMatch}${a}@import${s}url\\(${s}"${a}\\.css\\?)(${nw})("${s}\\);${a}${importEndMatch})`;
const findSourceCssVersionContentRegexp = new RegExp(findSourceCssVersionContent);

/**
 * 匹配外部css文件并捕获注释信息正则文本
 */
const findExternalCssPosition = 
    `${importStartMatch}${a}${
        getReg('VSCodeVersion')
    }${a}${
        getReg('ExtensionVersion')
    }${a}${
        getReg('Date')
    }${a}${
        getReg('ImageCode')
    }${a}${importEndMatch}`;
const findExternalCssPositionRegexp = new RegExp(findExternalCssPosition);

/**
 * 获取外部css文件中的透明度值正则
 */
const findExternalCssOpacityData = 
    `${importStartMatch}${a}body${s}\{${a}opacity${s}\:${s}(${ans})${s};${a}\}${a}${importEndMatch}`;
const findExternalCssOpacityDataRegexp = new RegExp(findExternalCssOpacityData);

/**
 * 对外部css文件的透明度进行修改的正则，包括动画样式内的透明度
*/
const externalCssOpacityModify = 
    `(${importStartMatch}${a}vscode-body-opacity-wyg${s}\{${a}to${s}\{${a
    }opacity${s}\:${s})(${ans})(${s};${a}\}${a}body${s}\{${a
    }opacity${s}\:${s})(${ans})(${s};${a}\}${a}${importEndMatch})`;
const externalCssOpacityModifyRegexp = new RegExp(externalCssOpacityModify);

/**
 * 修改外部css文件的背景图属性
 */
export function modifyCssFileForBackground (codeValue: string, random: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            if (!codeValue) {
                reject(new Error('null code'));
                return;
            }
            let infoContent: info | undefined;
            getExternalCssContent(codeValue).then(res => {
                if (res === false) {
                    // 不需要更新，直接跳出
                    throw { jump: true };
                }
                infoContent = res[1];
                return writeExternalCssFile(res[0]);
            }).then(() => {
                return settingConfiguration(infoContent!, random);
            }).then(() => {
                return setSourceCssImportInfo();
            }).then(() => {
                setBackgroundImageSuccess();
                resolve();
            }).catch(err => {
                // 传递了jump属性就resolve
                if (err.jump) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 删除外部和源css文件中背景图的相关设置内容
 */
export function deletebackgroundCssFileModification (): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            getSourceCssFileContent().then(data => {
                if (data) {
                    // 删除源css文件
                    return deleteContentByTagName(...data);
                }
            }).then(data => {
                if (data) {
                    const { content, uri } = data!;
                    return writeFileUri(uri, createBuffer(content));
                }
            }).then(() => {
                // 删除外部css文件
                return getExternalFileContent();
            }).then(data => {
                return deleteContentByTagName(...data);
            }).then(({ content, uri }) => {
                return uriDelete(uri);
            }).then(() => {
                return deleteConfiguration();
            }).then(() => {
                setBackgroundImageSuccess("背景图配置删除成功");
                isWindowReloadToLoadBackimage("背景图配置删除成功，是否重启窗口");
                resolve();
            }).catch(err => {
                reject(err);
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 校验外部设置背景样式css文件是否存在并且当前图片哈希码是否等于缓存中的哈希码
 * @returns 
 */
export function checExternalDataIsRight (): Promise<{modify:boolean}> {
    return new Promise((resolve, reject) => {
        try {
            getNowSettingCode().then(res => {
                if (res) {
                    return checkCurentImageIsSame(res);
                } else {
                    changeLoadState();
                    throw { jump: true, modify: false };
                }
            }).then(data => {
                const state = data!.state;
                if (state === true) {
                    // 当前不需要更新背景图css数据设置文件
                    throw { jump: true, modify: false };
                }
                if (data && data.code) {
                    // 编码校验失败或者没有css文件，重新写入
                    return modifyCssFileForBackground(data.code);
                } else {
                    throw { jump: true, modify: true };
                }
            }).then(() => {
                resolve({ modify:true });
            }).catch(err => {
                if (err.jump) {
                    resolve({ modify: err.modify });
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 将导入语句写入主样式文件中
 * @param init 是否是初始化调用，初始化调用此方法为校验，不需要进行文件修改
 * @returns 
 */
export function setSourceCssImportInfo (init: boolean = false) : Promise<{modify:boolean}> {
    return new Promise((resolve, reject) => {
        try {
            getSourceCssFileContent().then(data => {
                if (data) {
                    // 有数据，进行修改
                    return isSourceCssFileModify(...data);
                } else {
                    // 没有数据返回false
                    throw { jump: true, modify: false };
                }
            }).then(({ content, uri, exits }) => {
                const nowDate = new Date().getTime();
                let resContent: Buffer;
                if (exits === true) {
                    // 修改过源文件需要更换路径后的时间戳，去除缓存
                    if (!init) {
                        resContent = createBuffer(content.replace(findSourceCssVersionContentRegexp, `$1${nowDate}$3`));
                    } else {
                        // 源文件满足修改格式并且当前是初始化校验调用，则不进行文件改写并且通知外部函数当前未修改
                        throw { jump: true, modify: false };
                    }
                } else {
                    // 没有修改过源文件直接修改
                    resContent = createBuffer(`${importStart+'\n'
                        }@import url("./${externalFileName}?${nowDate}");${
                        '\n'+importEnd}`+content);
                }
                return writeFileUri(uri, resContent);
            }).then(() => {
                resolve({ modify: true });
            }).catch(err => {
                if (err.jump) {
                    resolve({ modify: err.modify });
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 检查指定code是否是当前设置背景图的code
 * @param codeValue 
 * @returns 如果state为false时也传了code，则此code是最新需要被设置的图片哈希码
 */
export function checkCurentImageIsSame (codeValue: string): Promise<{ state:boolean, code?:string }> {
    return new Promise((resolve, reject) => {
        try {
            if (!codeValue) {
                throw { jump: true, state: false };
            }
            getExternalFileContent().then(content => {
                return findInfo(content[0]);
            }).then(data => {
                if (data) {
                    const { ImageCode } = data;
                    // 如果和上一次是一个哈希值，不再更新数据
                    if (ImageCode === codeValue) {
                        throw { jump: true, state: true, code: ImageCode };
                    }
                }
                resolve({ state: false, code: codeValue });
            }).catch(err => {
                if (err.jump) {
                    resolve({ state: err.state, code: err.code??undefined });
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 设置当前背景哈希码缓存，将是否设置背景状态值改为true
 * @param options 
 */
function settingConfiguration (options: info, random: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        if (options) {
            backgroundImageConfiguration.setBackgroundIsSetBackground(true).then(() => {
                // 当不是随机切换时，将code存入当前图片缓存，否则存入随机切换图片缓存
                if (!random) {
                    return backgroundImageConfiguration.setBackgroundNowImagePath(options.ImageCode);
                } else  {
                    return backgroundImageConfiguration.setBackgroundRandomCode(options.ImageCode);
                }
            }, err => {
                reject(err);
            }).then(() => {
                resolve();
            }, err => {
                reject(err);
            });
        } else {
            resolve();
        }
    });
}

/**
 * 删除背景的缓存数据，将是否设置背景状态值改为false
*/
function deleteConfiguration (): Promise<void> {
    return new Promise((resolve, reject) => {
        backgroundImageConfiguration.setBackgroundNowImagePath("").then(() => {
            return backgroundImageConfiguration.setBackgroundIsSetBackground(false);
        }, err => {
            reject(err);
        }).then(() => {
            resolve();
        }, err => {
            reject(err);
        });
    });
}

/**
 * 获取vscode样式文件目录的Uri，没有指定name的文件就进行创建
 * @param name 指定文件名
 * @param create 没有文件是否创建
 * @returns 
 */
function getCssUri (name: string, create: boolean = true): Promise<Uri | void> {
    return new Promise((resolve, reject) => {
        try {
            if (name) {
                const uri = Uri.file(join(dirname((require.main as NodeModule).filename), 'vs', 'workbench', name));
                isFileExits(uri).then(res => {
                    if (res) {
                        // 有指定路径
                        throw { jump: true, uri };
                    } else {
                        if (!create) {
                            // 不创建文件，直接返回
                            throw { jump: true };
                        } else {
                            return writeFileUri(uri, createBuffer(""));
                        }
                    }
                }).then(() => {
                    resolve(uri);
                }).catch(err => {
                    if (err.jump) {
                        if (err.uri) {
                            resolve(err.uri);
                        } else {
                            resolve();
                        }
                    } else {
                        reject(err);
                    }
                });
            }
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 将背景样式写入外部样式文件
 * @param content 
 * @returns 
 */
export function writeExternalCssFile (content: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            getCssUri(externalFileName).then(uri => {
                if (uri) {
                    return writeFileUri(uri, createBuffer(content));
                }
            }).then(() => {
                resolve();
            }).catch(err => {
                reject(err);
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 获取外部css文件内容
 * @returns 
 */
export function getExternalFileContent (): Promise<[string, Uri]> {
    return new Promise((resolve, reject) => {
        try {
            let uriValue: Uri;
            // 获取指定路径uri，没有文件则创建
            getCssUri(externalFileName).then(uri => {
                uriValue = uri!;
                return readFileUri(uri!);
            }).then(content => {
                resolve([content.toString(), uriValue]);
            }).catch(err => {
                reject(err);
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 获取外部文件设置的背景样式字符串和相关信息，
 * 如果不需要更新数据即当前文件内的哈希码和需要设置的相同，则返回false
 * @param codeValue 
 */
function getExternalCssContent (codeValue: string): Promise<[string, info] | false> {
    return new Promise((resolve, reject) => {
        try {
            let imageUri: Uri;
            const extensionVer = getVersion();
            const date = getDate();
            imageStoreUri().then(uri => {
                if (!uri) {
                    throw new Error('null uri');
                }
                imageUri = uri;
                return getExternalFileContent();
            }).then(content => {
                return findInfo(content[0]);
            }).then(data => {
                if (data) {
                    const { ImageCode, VSCodeVersion, ExtensionVersion } = data;
                    // 如果和上一次是一个哈希值，并且vscode和插件版本号相同，不再更新数据
                    if (ImageCode === codeValue && VSCodeVersion === version && ExtensionVersion === extensionVer) {
                        throw { jump: true, data: false };
                    }
                }
                return readFileUri(newUri(imageUri, `${codeValue}.back.wyg`));
            }).then(image => {
                const opacity = getNewBackgroundOpacity(backgroundImageConfiguration.getBackgroundOpacity());
                const delay = 2; // 动画延迟的时间
                resolve([
                    `${importStart+'\n'
                    }/**${'\n'
                    }* VSCodeVersion [ ${version} ]${'\n'
                    }* ExtensionVersion [ ${extensionVer} ]${'\n'
                    }* Date [ ${date} ]${'\n'
                    }* ImageCode [ ${codeValue} ]${'\n'
                    }*/${'\n'
                    }@keyframes vscode-body-hide-wyg{from{background-size:0;}to{background-size:0;}}${'\n'
                    }@keyframes vscode-body-opacity-wyg{from{opacity:1;}to{opacity:${opacity};}}${'\n'
                    }body {${'\n'
                    }   opacity: ${opacity};${'\n'
                    }   background-repeat: no-repeat;${'\n'
                    }   background-size: cover;${'\n'
                    }   background-position: center;${'\n'
                    }   animation: vscode-body-hide-wyg ${delay}s,vscode-body-opacity-wyg 2s ease ${delay}s;${'\n'
                    }   background-image: url('${image}');${'\n'
                    }}${
                    '\n'+importEnd}`,
                    {
                        VSCodeVersion: version,
                        ExtensionVersion: extensionVer,
                        Date: date,
                        ImageCode: codeValue
                    }
                ]);
            }).catch(err => {
                if (err.jump) {
                    resolve(err.data);
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 获取缓存中的当前设置的背景图哈希码数据，
 * 如果没有缓存数据，返回false
 * @returns 
 */
function getNowSettingCode (): Promise<string | false> {
    return new Promise(resolve => {
        try {
            const storageCode = backgroundImageConfiguration.getBackgroundNowImagePath();
            if (!storageCode) {
                resolve(false);
            } else {
                resolve(storageCode);
            }
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 获取vscode源样式文件内容，返回内容文本和路径uri
 * @returns {[string, Uri]} 内容文本和路径uri
 */
function getSourceCssFileContent (): Promise<[string, Uri] | void> {
    return new Promise((resolve, reject) => {
        try {
            let uriValue: Uri;
            getCssUri(cssName, false).then(uri => {
                if (uri) {
                    uriValue = uri;
                    return readFileUri(uri);
                } else {
                    throw { jump: true };
                }
            }).then(res => {
                resolve([res!.toString(), uriValue]);
            }).catch(err => {
                if (err.jump) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 校验源css文件是否已经被修改，即是否已经添加引入外部css文件的语句，
 * 是则返回true，可以跳过
 * @param content 
 * @param uri 
 * @returns 
 */
function isSourceCssFileModify (content: string, uri: Uri): Promise<{ content:string, uri:Uri, exits:boolean }> {
    return new Promise(resolve => {
        try {
            const reg = content.match(findSourceCssPositionRegexp);
            // 有匹配项返回，exits字段为true
            if (reg) {
                resolve({ content, uri, exits: true });
            } else {
                resolve({ content, uri, exits: false })
            }
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 获取背景设置css文件的相关信息
 * @param content 
 * @returns 
 */
function findInfo (content: string): Promise<info | false> {
    return new Promise(resolve => {
        try {
            const reg = content.match(findExternalCssPositionRegexp);
            // 有匹配项返回信息
            if (reg) {
                resolve({
                    VSCodeVersion: reg[1],
                    ExtensionVersion: reg[2],
                    Date: reg[3],
                    ImageCode: reg[4]
                });
            } else {
                resolve(false);
            }
        } catch (error) {
            errHandle(error);
        }
    });
}

/**
 * 生成获取外部文件注释信息的正则
 * @param name 
 * @returns 
 */
function getReg (name: string, catchData: boolean = true): string {
    if (catchData) return `${name}${s}\\[${s}(${asa})${s}\\]`;
    return `${name}${s}\\[${s}${asa}${s}\\]`;
}

/**
 * 通过标签名删除css文件的修改内容
 * @param content 需要被处理的文本
 */
function deleteContentByTagName (content: string, uri: Uri): Promise<ContentAndUri> {
    return new Promise((resolve, reject) => {
        try {
            if (!content) {
                resolve({content:"", uri});
                return;
            }
            content = content.replace(findSourceCssPositionRegexp, "");
            resolve({content, uri});
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 获取外部css文件修改了透明度后的内容
 * @param value 
 * @returns 
 */
export function getExternalCssModifyOpacityContent (content: string, value: number): string {
    return content.replace(externalCssOpacityModifyRegexp, `$1${value}$3${value}$5`);
}