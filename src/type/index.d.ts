// 定义标准响应类型
declare interface JSBridgeResponse<T = any> {
    code: number;
    message?: string;
    data: T;
}
// 定义原生方法类型约束
declare interface Window {
    JSBridge: {
        [key: string]: (callbackId: string, ...args: any[]) => void;
    };
    webkit: {
        messageHandlers: {
            [key: string]: {
                postMessage: (params: { funname: string, args: unknown[], callbackId: string }) => void;
            };
        };
    }
    appCallBack: (callbackId: string, res: JSBridgeResponse) => void;
}