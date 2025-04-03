

class JSBridge {
    private callBackMap: Map<
        string,
        {
            resolve: (value: unknown) => void;
            reject: (reason?: any) => void;
            timeoutId: number;
        }
    >;

    private timeout: number;

    constructor(timeout: number = 10000) {
        this.callBackMap = new Map();
        this.timeout = timeout;
        window.appCallBack = this.appCallBack.bind(this);
    }
    static isAndroid(): boolean {
        return /android|adr/i.test(window.navigator.userAgent)
    }

    static isIOS(): boolean {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !/windows phone/i.test(window.navigator.userAgent)
    }
    // 生成唯一回调ID（碰撞概率 < 1e-15）
    private generateCallbackId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}_${random}`;
    }

    // 泛型方法调用（核心方法）
    public invoke<T = any>(funname: string, ...args: any[]): Promise<T> {
        const platform = JSBridge.isAndroid() ? 'android' : JSBridge.isIOS() ? 'ios' : 'unknown'

        return new Promise((resolve, reject) => {
            const callbackId = this.generateCallbackId();

            // 方法存在性校验
            if (typeof window.JSBridge?.[funname] !== 'function') {
                reject(new Error(`[JSBridge] Method ${funname} not exists`));
                return;
            }

            const timeoutId = setTimeout(() => {
                this.cleanup(callbackId);
                reject(new Error(`[JSBridge] Timeout (${this.timeout}ms)`));
            }, this.timeout);

            this.callBackMap.set(callbackId, {
                resolve: (value: unknown) => {
                    const res = value as JSBridgeResponse<T>;
                    if (res.code >= 400) {
                        reject(new Error(res.message || `Error code ${res.code}`));
                    } else {
                        resolve(res.data);
                    }
                },
                reject,
                timeoutId
            });

            try {
                if (platform === 'android') {
                    window.JSBridge[funname](callbackId, ...args);
                    return;
                }
                if (platform === 'ios') {
                    window.webkit.messageHandlers.JSBridge.postMessage({ funname, args, callbackId })
                    return;
                }
                reject(new Error(`[JSBridge] Platform ${platform} not support`));
            } catch (err) {
                this.cleanup(callbackId);
                reject(new Error(`[JSBridge] Invoke error: ${err}`));
            }
        });
    }

    private cleanup(callbackId: string): void {
        const item = this.callBackMap.get(callbackId);
        if (item) {
            clearTimeout(item.timeoutId);
            this.callBackMap.delete(callbackId);
        }
    }

    // 统一回调处理器
    private appCallBack(callbackId: string, res: JSBridgeResponse): void {
        const item = this.callBackMap.get(callbackId);
        if (!item) {
            console.warn(`[JSBridge] Unknown callback ID: ${callbackId}`);
            return;
        }

        this.cleanup(callbackId);
        if (typeof res !== 'object') {
            try {
                res = JSON.parse(res) as JSBridgeResponse
            } catch (e) {
                item.reject(new Error(`[JSBridge] Parse error: ${e}`))
            }
        }
        if (res.code === 200) {
            item.resolve(res);
        } else {
            item.reject(new Error(res.message || `Error code ${res.code}`));
        }
    }
}

export default JSBridge;