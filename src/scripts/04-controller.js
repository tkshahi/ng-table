/**
 * ngTable: Table + Angular JS
 *
 * @author Vitalii Savchuk <esvit666@gmail.com>
 * @url https://github.com/esvit/ng-table/
 * @license New BSD License <http://creativecommons.org/licenses/BSD/>
 */

/**
 * @ngdoc object
 * @name ngTable.directive:ngTable.ngTableController
 *
 * @description
 * Each {@link ngTable.directive:ngTable ngTable} directive creates an instance of `ngTableController`
 */
app.controller('ngTableController', ['$scope', 'NgTableParams', '$timeout', '$parse', '$compile', '$attrs', '$element',
    'ngTableColumn',
function($scope, NgTableParams, $timeout, $parse, $compile, $attrs, $element, ngTableColumn) {
    var isFirstTimeLoad = true;
    $scope.$filterRow = {};
    $scope.$loading = false;

    if (!($scope.params instanceof NgTableParams)) {
        $scope.params = new NgTableParams();
        $scope.params.isNullInstance = true;
    }
    $scope.params.settings().$scope = $scope;

    var delayFilter = (function() {
        var timer = 0;
        return function(callback, ms) {
            $timeout.cancel(timer);
            timer = $timeout(callback, ms);
        };
    })();

    function resetPage() {
        $scope.params.$params.page = 1;
    }

    $scope.$watch('params.$params', function(newParams, oldParams) {

        if (newParams === oldParams) {
            return;
        }

        $scope.params.settings().$scope = $scope;

        if (!angular.equals(newParams.filter, oldParams.filter)) {
            var maybeResetPage = isFirstTimeLoad ? angular.noop : resetPage;
            delayFilter(function() {
                maybeResetPage();
                $scope.params.reload();
            }, $scope.params.settings().filterDelay);
        } else {
            $scope.params.reload();
        }

        if (!$scope.params.isNullInstance) {
            isFirstTimeLoad = false;
        }

    }, true);

    this.compileDirectiveTemplates = function () {
        if (!$element.hasClass('ng-table')) {
            $scope.templates = {
                header: ($attrs.templateHeader ? $attrs.templateHeader : 'ng-table/header.html'),
                pagination: ($attrs.templatePagination ? $attrs.templatePagination : 'ng-table/pager.html')
            };
            $element.addClass('ng-table');
            var headerTemplate = null;
            if ($element.find('> thead').length === 0) {
                headerTemplate = angular.element(document.createElement('thead')).attr('ng-include', 'templates.header');
                $element.prepend(headerTemplate);
            }
            var paginationTemplate = angular.element(document.createElement('div')).attr({
                'ng-table-pagination': 'params',
                'template-url': 'templates.pagination'
            });
            $element.after(paginationTemplate);
            if (headerTemplate) {
                $compile(headerTemplate)($scope);
            }
            $compile(paginationTemplate)($scope);
        }
    };

    this.loadFilterData = function (columns) {
        angular.forEach(columns, function (column) {
            var def;
            def = column.filterData($scope, {
                $column: column
            });
            if (!def) {
                delete column.filterData;
                return;
            }

            // if we're working with a deferred object, let's wait for the promise
            if ((angular.isObject(def) && angular.isObject(def.promise))) {
                delete column.filterData;
                return def.promise.then(function(data) {
                    // our deferred can eventually return arrays, functions and objects
                    if (!angular.isArray(data) && !angular.isFunction(data) && !angular.isObject(data)) {
                        // if none of the above was found - we just want an empty array
                        data = [];
                    } else if (angular.isArray(data)) {
                        data.unshift({
                            title: '-',
                            id: ''
                        });
                    }
                    column.data = data;
                });
            }
            // otherwise, we just return what the user gave us. It could be a function, array, object, whatever
            else {
                return column.data = def;
            }
        });
    };

    this.buildColumns = function (columns) {
        return columns.map(ngTableColumn.buildColumn)
    };

    this.setupBindingsToInternalScope = function(tableParamsExpr){

        // note: this we're setting up watches to simulate angular's isolated scope bindings

        $scope.$watch(tableParamsExpr, (function (params) {
            if (angular.isUndefined(params)) {
                return;
            }
            $scope.paramsModel = $parse(tableParamsExpr);
            $scope.params = params;
        }), true);

        if ($attrs.showFilter) {
            $scope.$parent.$watch($attrs.showFilter, function(value) {
                $scope.show_filter = value;
            });
        }
        if ($attrs.disableFilter) {
            $scope.$parent.$watch($attrs.disableFilter, function(value) {
                $scope.$filterRow.disabled = value;
            });
        }
    };

    $scope.sortBy = function(column, event) {
        var parsedSortable = column.sortable && column.sortable($scope);
        if (!parsedSortable) {
            return;
        }
        var defaultSort = $scope.params.settings().defaultSort;
        var inverseSort = (defaultSort === 'asc' ? 'desc' : 'asc');
        var sorting = $scope.params.sorting() && $scope.params.sorting()[parsedSortable] && ($scope.params.sorting()[parsedSortable] === defaultSort);
        var sortingParams = (event.ctrlKey || event.metaKey) ? $scope.params.sorting() : {};
        sortingParams[parsedSortable] = (sorting ? inverseSort : defaultSort);
        $scope.params.parameters({
            sorting: sortingParams
        });
    };
}]);


/**
 * @ngdoc service
 * @name ngTable.factory:ngTableColumn
 *
 * @description
 * Service to construct a column definition used by {@link ngTable.directive:ngTable ngTable} directive
 */
app.factory('ngTableColumn', [function () {

    var defaults = {
        'class': function(){ return ''; },
        filter: function(){ return false; },
        filterData: angular.noop,
        headerTemplateURL: function(){ return false; },
        headerTitle: function(){ return ' '; },
        sortable: function(){ return false; },
        show: function(){ return true; },
        title: function(){ return ' '; }
    };

    function buildColumn(column){
        // note: we're not modifying the original column object. This helps to avoid unintended side affects
        var extendedCol = Object.create(column);
        for (var prop in defaults) {
            if (extendedCol[prop] === undefined) {
                extendedCol[prop] = defaults[prop];
            }
            if(!angular.isFunction(extendedCol[prop])){
                // wrap raw field values with "getter" functions
                // - this is to ensure consistency with how ngTable.compile builds columns
                // - note that the original column object is being "proxied"; this is important
                //   as it ensure that any changes to the original object will be returned by the "getter"
                (function(prop1){
                    extendedCol[prop1] = function(){
                        return column[prop1];
                    };
                })(prop);
            }
        }
        return extendedCol;
    }

    return {
        buildColumn: buildColumn
    };
}]);