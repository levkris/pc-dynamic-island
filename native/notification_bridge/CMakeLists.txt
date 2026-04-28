cmake_minimum_required(VERSION 3.20)
project(notification_bridge CXX)

if(NOT WIN32)
    message(FATAL_ERROR "notification_bridge is Windows-only.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(notification_bridge main.cpp)

target_compile_definitions(notification_bridge PRIVATE
    UNICODE
    _UNICODE
    NOMINMAX
    WIN32_LEAN_AND_MEAN
    WINVER=0x0A00
    _WIN32_WINNT=0x0A00
)

target_compile_options(notification_bridge PRIVATE
    /W3
    /EHsc
    /permissive-
    /await
    /utf-8
)

target_link_libraries(notification_bridge PRIVATE
    WindowsApp
)

set_target_properties(notification_bridge PROPERTIES
    WIN32_EXECUTABLE FALSE
    OUTPUT_NAME "notification_bridge"
)