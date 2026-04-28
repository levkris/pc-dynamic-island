#include <Windows.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.UI.Notifications.h>
#include <winrt/Windows.UI.Notifications.Management.h>

#include <iostream>
#include <string>
#include <sstream>
#include <set>

using namespace winrt;
using namespace Windows::UI::Notifications;
using namespace Windows::UI::Notifications::Management;

static std::wstring EscapeJson(std::wstring_view input) {
    std::wostringstream ss;
    for (wchar_t c : input) {
        switch (c) {
            case L'"':  ss << L"\\\""; break;
            case L'\\': ss << L"\\\\"; break;
            case L'\n': ss << L"\\n";  break;
            case L'\r': ss << L"\\r";  break;
            case L'\t': ss << L"\\t";  break;
            default:    ss << c;       break;
        }
    }
    return ss.str();
}

static void EmitAdded(uint32_t id, std::wstring_view appName, std::wstring_view title, std::wstring_view body) {
    std::wostringstream json;
    json << L"{"
         << L"\"id\":" << id
         << L",\"kind\":\"added\""
         << L",\"app\":\"" << EscapeJson(appName) << L"\""
         << L",\"title\":\"" << EscapeJson(title) << L"\""
         << L",\"body\":\"" << EscapeJson(body) << L"\""
         << L"}";
    std::wcout << json.str() << L"\n";
    std::wcout.flush();
}

static void EmitRemoved(uint32_t id) {
    std::wcout << L"{\"id\":" << id << L",\"kind\":\"removed\"}\n";
    std::wcout.flush();
}

int wmain() {
    try {
        init_apartment();

        auto listener = UserNotificationListener::Current();
        auto status = listener.RequestAccessAsync().get();

        if (status != UserNotificationListenerAccessStatus::Allowed) {
            std::wcerr << L"{\"error\":\"Notification listener access denied.\"}\n";
            std::wcerr.flush();
            return 1;
        }

        std::wcerr << L"{\"status\":\"listening\"}\n";
        std::wcerr.flush();

        std::set<uint32_t> knownIds;

        while (true) {
            try {
                auto notifications = listener.GetNotificationsAsync(NotificationKinds::Toast).get();
                std::set<uint32_t> currentIds;

                for (auto const& notif : notifications) {
                    uint32_t id = notif.Id();
                    currentIds.insert(id);

                    if (knownIds.count(id)) continue;

                    std::wstring appName = L"";
                    std::wstring title = L"";
                    std::wstring body = L"";

                    try { appName = std::wstring(notif.AppInfo().DisplayInfo().DisplayName()); } catch (...) {}

                    try {
                        auto binding = notif.Notification().Visual().GetBinding(KnownNotificationBindings::ToastGeneric());
                        if (binding) {
                            auto elements = binding.GetTextElements();
                            if (elements.Size() > 0) title = std::wstring(elements.GetAt(0).Text());
                            if (elements.Size() > 1) body = std::wstring(elements.GetAt(1).Text());
                        }
                    } catch (...) {}

                    EmitAdded(id, appName, title, body);
                }

                for (uint32_t id : knownIds) {
                    if (!currentIds.count(id)) EmitRemoved(id);
                }

                knownIds = std::move(currentIds);
            } catch (...) {}

            Sleep(1000);
        }
    } catch (winrt::hresult_error const& e) {
        std::wcerr << L"{\"error\":\"" << e.message().c_str() << L"\"}\n";
        std::wcerr.flush();
        return 1;
    }

    return 0;
}