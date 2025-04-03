# jsbridge-webview-native

WebView 与原生双向通信桥接库，支持 Android/iOS 双端调用，提供完整 TypeScript 类型声明。

## 功能特性

- 📱 双端平台自动检测（Android/iOS UserAgent 识别）
- ⏱️ 可配置请求超时机制（默认 10 秒）
- 🔒 强类型校验（TS 类型声明）
- 🛡️ 自动内存回收（超时/完成自动清理）
- 🚨 完善错误处理（方法不存在/平台不支持/超时错误）

## 安装

```bash
npm install jsbridge-webview-native
```

## 基础用法

```typescript
import JSBridge from "jsbridge-webview-native";

// 初始化（可选配置超时时间）
const bridge = new JSBridge(15000);

// 调用原生方法
bridge
  .invoke<string>("getDeviceInfo")
  .then((data) => {
    console.log("设备信息:", data);
  })
  .catch((err) => {
    console.error("调用失败:", err.message);
  });

// 带参数的调用
bridge.invoke<boolean>("enableGPS", true).then((success) => {
  if (success) console.log("GPS已开启");
});
```

## 错误处理

```typescript
try {
  const result = await bridge.invoke("unsupportedMethod");
} catch (err) {
  if (err.message.includes("Method not exists")) {
    // 处理不存在的方法
  }
  if (err.message.includes("Timeout")) {
    // 处理超时
  }
}
```

## 平台适配

| 特性           | Android           | iOS               |
| -------------- | ----------------- | ----------------- |
| 调用方式       | JSBridge.method   | webkit 消息处理器 |
| UserAgent 检测 | 包含 android 标识 | 包含 iOS 设备标识 |

## 注意事项

1. 确保原生端已实现对应方法
2. 原生返回数据格式必须为

```js
JSBridgeResponse<T = any> {
    code: number;
    message?: string;
    data: T;
}
```

其中 `code` 为 200 表示成功，非 200 表示失败。

## 原生代码示例

### Android

```java
public class AndroidJSBridge {
    private final WebView webView;
    private final Handler handler = new Handler(Looper.getMainLooper());

    public AndroidJSBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public void getUserInfo(String callbackId, String userId) {
        // 模拟异步操作
        new Thread(() -> {
            try {
                // 1. 业务逻辑处理
                JSONObject userData = new JSONObject();
                userData.put("name", "John");
                userData.put("age", 30);

                // 2. 构造响应格式
                JSONObject response = new JSONObject();
                response.put("code", 200);
                response.put("data", userData);

                // 3. 回调Web端
                sendCallback(callbackId, response.toString());
            } catch (JSONException e) {
                sendError(callbackId, 500, "Data processing error");
            }
        }).start();
    }

    private void sendCallback(String callbackId, String result) {
        handler.post(() -> {
            String js = String.format("window.appCallBack('%s', %s)",
                callbackId, result);
            webView.evaluateJavascript(js, null);
        });
    }

    private void sendError(String callbackId, int code, String message) {
        handler.post(() -> {
            String error = String.format("{code: %d, message: '%s'}", code, message);
            String js = String.format("window.appCallBack('%s', %s)",
                callbackId, error);
            webView.evaluateJavascript(js, null);
        });
    }
}

// WebView 配置
webView.getSettings().setJavaScriptEnabled(true);
webView.addJavascriptInterface(new AndroidJSBridge(webView), "JSBridge");

```

### iOS

```swift
class iOSJSBridge: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()

        // 添加消息处理器
        webView.configuration.userContentController.add(self, name: "JSBridge")
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "JSBridge",
              let body = message.body as? [String: Any],
              let funname = body["funname"] as? String,
              let args = body["args"] as? [Any],
              let callbackId = body["callbackId"] as? String else {
            return
        }

        switch funname {
        case "getUserInfo":
            handleGetUserInfo(callbackId: callbackId, args: args)
        default:
            sendError(callbackId: callbackId, code: 404, message: "Method not found")
        }
    }

    private func handleGetUserInfo(callbackId: String, args: [Any]) {
        // 模拟异步操作
        DispatchQueue.global().async {
            let userId = args.first as? String ?? ""

            // 构造响应数据
            let response: [String: Any] = [
                "code": 200,
                "data": [
                    "name": "Jane",
                    "age": 28
                ]
            ]

            self.sendCallback(callbackId: callbackId, response: response)
        }
    }

    private func sendCallback(callbackId: String, response: [String: Any]) {
        DispatchQueue.main.async {
            guard let jsonData = try? JSONSerialization.data(withJSONObject: response),
                  let jsonString = String(data: jsonData, encoding: .utf8) else {
                self.sendError(callbackId: callbackId, code: 500, message: "JSON parsing failed")
                return
            }

            let js = "window.appCallBack('\(callbackId)', \(jsonString))"
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func sendError(callbackId: String, code: Int, message: String) {
        let error: [String: Any] = [
            "code": code,
            "message": message
        ]

        DispatchQueue.main.async {
            let js = "window.appCallBack('\(callbackId)', \(error))"
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

// WebView 配置
let webView = WKWebView(frame: .zero)
let bridge = iOSJSBridge(webView: webView)

```
