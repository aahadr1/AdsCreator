"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/persist/route";
exports.ids = ["app/api/persist/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "punycode":
/*!***************************!*\
  !*** external "punycode" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("punycode");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fpersist%2Froute&page=%2Fapi%2Fpersist%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fpersist%2Froute.ts&appDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!***********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fpersist%2Froute&page=%2Fapi%2Fpersist%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fpersist%2Froute.ts&appDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \***********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_Aaron_Downloads_next_lipsync_app_app_api_persist_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/persist/route.ts */ \"(rsc)/./app/api/persist/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/persist/route\",\n        pathname: \"/api/persist\",\n        filename: \"route\",\n        bundlePath: \"app/api/persist/route\"\n    },\n    resolvedPagePath: \"/Users/Aaron/Downloads/next-lipsync-app/app/api/persist/route.ts\",\n    nextConfigOutput,\n    userland: _Users_Aaron_Downloads_next_lipsync_app_app_api_persist_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/persist/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZwZXJzaXN0JTJGcm91dGUmcGFnZT0lMkZhcGklMkZwZXJzaXN0JTJGcm91dGUmYXBwUGF0aHM9JnBhZ2VQYXRoPXByaXZhdGUtbmV4dC1hcHAtZGlyJTJGYXBpJTJGcGVyc2lzdCUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRkFhcm9uJTJGRG93bmxvYWRzJTJGbmV4dC1saXBzeW5jLWFwcCUyRmFwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9JTJGVXNlcnMlMkZBYXJvbiUyRkRvd25sb2FkcyUyRm5leHQtbGlwc3luYy1hcHAmaXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9JnByZWZlcnJlZFJlZ2lvbj0mbWlkZGxld2FyZUNvbmZpZz1lMzAlM0QhIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFzRztBQUN2QztBQUNjO0FBQ2dCO0FBQzdGO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixnSEFBbUI7QUFDM0M7QUFDQSxjQUFjLHlFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsaUVBQWlFO0FBQ3pFO0FBQ0E7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDdUg7O0FBRXZIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbmV4dC1saXBzeW5jLWFwcC8/ZDlkNiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCIvVXNlcnMvQWFyb24vRG93bmxvYWRzL25leHQtbGlwc3luYy1hcHAvYXBwL2FwaS9wZXJzaXN0L3JvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9wZXJzaXN0L3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvcGVyc2lzdFwiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvcGVyc2lzdC9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIi9Vc2Vycy9BYXJvbi9Eb3dubG9hZHMvbmV4dC1saXBzeW5jLWFwcC9hcHAvYXBpL3BlcnNpc3Qvcm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5jb25zdCBvcmlnaW5hbFBhdGhuYW1lID0gXCIvYXBpL3BlcnNpc3Qvcm91dGVcIjtcbmZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgcmV0dXJuIF9wYXRjaEZldGNoKHtcbiAgICAgICAgc2VydmVySG9va3MsXG4gICAgICAgIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2VcbiAgICB9KTtcbn1cbmV4cG9ydCB7IHJvdXRlTW9kdWxlLCByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgb3JpZ2luYWxQYXRobmFtZSwgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fpersist%2Froute&page=%2Fapi%2Fpersist%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fpersist%2Froute.ts&appDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/persist/route.ts":
/*!**********************************!*\
  !*** ./app/api/persist/route.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   POST: () => (/* binding */ POST),\n/* harmony export */   runtime: () => (/* binding */ runtime)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ \"(rsc)/./node_modules/@supabase/supabase-js/dist/module/index.js\");\n\nconst runtime = \"nodejs\";\nasync function POST(req) {\n    try {\n        const supabaseUrl = process.env.SUPABASE_URL || \"https://ueunqeqrvtuofpdoozye.supabase.co\" || 0;\n        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldW5xZXFydnR1b2ZwZG9venllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxOTM4NjMsImV4cCI6MjA3MTc2OTg2M30.JY5i-uB5vZJ6enhWVgf9Bwg9bK2BFjmuXuOfjbQEQUw\" || 0;\n        const bucket = process.env.SUPABASE_BUCKET || \"assets\";\n        const publicBucket = (process.env.SUPABASE_BUCKET_PUBLIC || \"true\").toLowerCase() === \"true\";\n        if (!supabaseUrl || !serviceRoleKey) return new Response(\"Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY\", {\n            status: 500\n        });\n        const body = await req.json();\n        const url = (body?.url || \"\").trim();\n        if (!url) return new Response(\"Missing url\", {\n            status: 400\n        });\n        const supabase = (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(supabaseUrl, serviceRoleKey, {\n            auth: {\n                persistSession: false\n            }\n        });\n        // Ensure bucket\n        try {\n            const { data: bucketInfo } = await supabase.storage.getBucket(bucket);\n            if (!bucketInfo) await supabase.storage.createBucket(bucket, {\n                public: publicBucket\n            });\n        } catch  {}\n        // Fetch\n        const res = await fetch(url);\n        if (!res.ok) return new Response(`Fetch failed: ${res.statusText}`, {\n            status: 400\n        });\n        const arrayBuffer = await res.arrayBuffer();\n        const contentType = res.headers.get(\"content-type\") || \"application/octet-stream\";\n        // Path\n        const folder = (body?.folder || \"outputs\").replace(/[^a-zA-Z0-9_\\/-]/g, \"_\");\n        const namePart = (body?.filename || url.split(\"/\").pop() || \"file\").split(\"?\")[0].replace(/[^a-zA-Z0-9_.-]/g, \"_\");\n        const path = `${folder}/${Date.now()}-${namePart}`;\n        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, new Uint8Array(arrayBuffer), {\n            upsert: false,\n            cacheControl: \"31536000\",\n            contentType\n        });\n        if (uploadError) return new Response(`Upload failed: ${uploadError.message}`, {\n            status: 500\n        });\n        const publicUrl = publicBucket ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : (await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)).data?.signedUrl || \"\";\n        return Response.json({\n            url: publicUrl,\n            path,\n            bucket\n        });\n    } catch (e) {\n        return new Response(`Error: ${e.message}`, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LE1BQU0sS0FBSyxLQUFLLEtBQUssSUFBRyxFQUFHcEIsSUFBSSxFQUFFa0MsYUFBYTtRQUV2RyxPQUFPM0MsU0FBU0csSUFBSSxDQUFDO1lBQUVDLEtBQUtvQztZQUFXWDtZQUFNbEM7UUFBTztJQUN0RCxFQUFFLE9BQU9pRCxHQUFRO1FBQ2YsT0FBTyxJQUFJNUMsU0FBUyxDQUFDLE9BQU8sRUFBRTRDLEVBQUVMLE9BQU8sQ0FBQyxDQUFDLEVBQUU7WUFBRXRDLFFBQVE7UUFBSTtJQUMzRDtBQUNGIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbmV4dC1saXBzeW5jLWFwcC8uL2FwcC9hcGkvcGVyc2lzdC9yb3V0ZS50cz9mOWRiIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXF1ZXN0IH0gZnJvbSAnbmV4dC9zZXJ2ZXInO1xuaW1wb3J0IHsgY3JlYXRlQ2xpZW50IH0gZnJvbSAnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJztcblxuZXhwb3J0IGNvbnN0IHJ1bnRpbWUgPSAnbm9kZWpzJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxOiBOZXh0UmVxdWVzdCkge1xuICB0cnkge1xuICAgIGNvbnN0IHN1cGFiYXNlVXJsID0gcHJvY2Vzcy5lbnYuU1VQQUJBU0VfVVJMIHx8IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX1NVUEFCQVNFX1VSTCB8fCAnJztcbiAgICBjb25zdCBzZXJ2aWNlUm9sZUtleSA9IHByb2Nlc3MuZW52LlNVUEFCQVNFX1NFUlZJQ0VfUk9MRV9LRVkgfHwgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfU1VQQUJBU0VfQU5PTl9LRVkgfHwgJyc7XG4gICAgY29uc3QgYnVja2V0ID0gcHJvY2Vzcy5lbnYuU1VQQUJBU0VfQlVDS0VUIHx8ICdhc3NldHMnO1xuICAgIGNvbnN0IHB1YmxpY0J1Y2tldCA9IChwcm9jZXNzLmVudi5TVVBBQkFTRV9CVUNLRVRfUFVCTElDIHx8ICd0cnVlJykudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xuICAgIGlmICghc3VwYWJhc2VVcmwgfHwgIXNlcnZpY2VSb2xlS2V5KSByZXR1cm4gbmV3IFJlc3BvbnNlKCdTZXJ2ZXIgbWlzY29uZmlndXJlZDogbWlzc2luZyBTVVBBQkFTRV9VUkwvU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWScsIHsgc3RhdHVzOiA1MDAgfSk7XG5cbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxLmpzb24oKSBhcyB7IHVybD86IHN0cmluZzsgZmlsZW5hbWU/OiBzdHJpbmcgfCBudWxsOyBmb2xkZXI/OiBzdHJpbmcgfCBudWxsIH0gfCBudWxsO1xuICAgIGNvbnN0IHVybCA9IChib2R5Py51cmwgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAoIXVybCkgcmV0dXJuIG5ldyBSZXNwb25zZSgnTWlzc2luZyB1cmwnLCB7IHN0YXR1czogNDAwIH0pO1xuXG4gICAgY29uc3Qgc3VwYWJhc2UgPSBjcmVhdGVDbGllbnQoc3VwYWJhc2VVcmwsIHNlcnZpY2VSb2xlS2V5LCB7IGF1dGg6IHsgcGVyc2lzdFNlc3Npb246IGZhbHNlIH0gfSk7XG4gICAgLy8gRW5zdXJlIGJ1Y2tldFxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGRhdGE6IGJ1Y2tldEluZm8gfSA9IGF3YWl0IHN1cGFiYXNlLnN0b3JhZ2UuZ2V0QnVja2V0KGJ1Y2tldCk7XG4gICAgICBpZiAoIWJ1Y2tldEluZm8pIGF3YWl0IHN1cGFiYXNlLnN0b3JhZ2UuY3JlYXRlQnVja2V0KGJ1Y2tldCwgeyBwdWJsaWM6IHB1YmxpY0J1Y2tldCB9KTtcbiAgICB9IGNhdGNoIHt9XG5cbiAgICAvLyBGZXRjaFxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCk7XG4gICAgaWYgKCFyZXMub2spIHJldHVybiBuZXcgUmVzcG9uc2UoYEZldGNoIGZhaWxlZDogJHtyZXMuc3RhdHVzVGV4dH1gLCB7IHN0YXR1czogNDAwIH0pO1xuICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgcmVzLmFycmF5QnVmZmVyKCk7XG4gICAgY29uc3QgY29udGVudFR5cGUgPSByZXMuaGVhZGVycy5nZXQoJ2NvbnRlbnQtdHlwZScpIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xuXG4gICAgLy8gUGF0aFxuICAgIGNvbnN0IGZvbGRlciA9IChib2R5Py5mb2xkZXIgfHwgJ291dHB1dHMnKS5yZXBsYWNlKC9bXmEtekEtWjAtOV9cXC8tXS9nLCAnXycpO1xuICAgIGNvbnN0IG5hbWVQYXJ0ID0gKGJvZHk/LmZpbGVuYW1lIHx8IHVybC5zcGxpdCgnLycpLnBvcCgpIHx8ICdmaWxlJykuc3BsaXQoJz8nKVswXS5yZXBsYWNlKC9bXmEtekEtWjAtOV8uLV0vZywgJ18nKTtcbiAgICBjb25zdCBwYXRoID0gYCR7Zm9sZGVyfS8ke0RhdGUubm93KCl9LSR7bmFtZVBhcnR9YDtcblxuICAgIGNvbnN0IHsgZXJyb3I6IHVwbG9hZEVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZS5zdG9yYWdlXG4gICAgICAuZnJvbShidWNrZXQpXG4gICAgICAudXBsb2FkKHBhdGgsIG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKSwgeyB1cHNlcnQ6IGZhbHNlLCBjYWNoZUNvbnRyb2w6ICczMTUzNjAwMCcsIGNvbnRlbnRUeXBlIH0pO1xuICAgIGlmICh1cGxvYWRFcnJvcikgcmV0dXJuIG5ldyBSZXNwb25zZShgVXBsb2FkIGZhaWxlZDogJHt1cGxvYWRFcnJvci5tZXNzYWdlfWAsIHsgc3RhdHVzOiA1MDAgfSk7XG5cbiAgICBjb25zdCBwdWJsaWNVcmwgPSBwdWJsaWNCdWNrZXRcbiAgICAgID8gc3VwYWJhc2Uuc3RvcmFnZS5mcm9tKGJ1Y2tldCkuZ2V0UHVibGljVXJsKHBhdGgpLmRhdGEucHVibGljVXJsXG4gICAgICA6IChhd2FpdCBzdXBhYmFzZS5zdG9yYWdlLmZyb20oYnVja2V0KS5jcmVhdGVTaWduZWRVcmwocGF0aCwgNjAgKiA2MCAqIDI0ICogMzY1KSkuZGF0YT8uc2lnbmVkVXJsIHx8ICcnO1xuXG4gICAgcmV0dXJuIFJlc3BvbnNlLmpzb24oeyB1cmw6IHB1YmxpY1VybCwgcGF0aCwgYnVja2V0IH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKGBFcnJvcjogJHtlLm1lc3NhZ2V9YCwgeyBzdGF0dXM6IDUwMCB9KTtcbiAgfVxufVxuXG5cblxuXG5cbiJdLCJuYW1lcyI6WyJjcmVhdGVDbGllbnQiLCJydW50aW1lIiwiUE9TVCIsInJlcSIsInN1cGFiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIlNVUEFCQVNFX1VSTCIsIk5FWFRfUFVCTElDX1NVUEFCQVNFX1VSTCIsInNlcnZpY2VSb2xlS2V5IiwiU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWSIsIk5FWFRfUFVCTElDX1NVUEFCQVNFX0FOT05fS0VZIiwiYnVja2V0IiwiU1VQQUJBU0VfQlVDS0VUIiwicHVibGljQnVja2V0IiwiU1VQQUJBU0VfQlVDS0VUX1BVQkxJQyIsInRvTG93ZXJDYXNlIiwiUmVzcG9uc2UiLCJzdGF0dXMiLCJib2R5IiwianNvbiIsInVybCIsInRyaW0iLCJzdXBhYmFzZSIsImF1dGgiLCJwZXJzaXN0U2Vzc2lvbiIsImRhdGEiLCJidWNrZXRJbmZvIiwic3RvcmFnZSIsImdldEJ1Y2tldCIsImNyZWF0ZUJ1Y2tldCIsInB1YmxpYyIsInJlcyIsImZldGNoIiwib2siLCJzdGF0dXNUZXh0IiwiYXJyYXlCdWZmZXIiLCJjb250ZW50VHlwZSIsImhlYWRlcnMiLCJnZXQiLCJmb2xkZXIiLCJyZXBsYWNlIiwibmFtZVBhcnQiLCJmaWxlbmFtZSIsInNwbGl0IiwicG9wIiwicGF0aCIsIkRhdGUiLCJub3ciLCJlcnJvciIsInVwbG9hZEVycm9yIiwiZnJvbSIsInVwbG9hZCIsIlVpbnQ4QXJyYXkiLCJ1cHNlcnQiLCJjYWNoZUNvbnRyb2wiLCJtZXNzYWdlIiwicHVibGljVXJsIiwiZ2V0UHVibGljVXJsIiwiY3JlYXRlU2lnbmVkVXJsIiwic2lnbmVkVXJsIiwiZSJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./app/api/persist/route.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@supabase","vendor-chunks/tr46","vendor-chunks/whatwg-url","vendor-chunks/webidl-conversions"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fpersist%2Froute&page=%2Fapi%2Fpersist%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fpersist%2Froute.ts&appDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FAaron%2FDownloads%2Fnext-lipsync-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();