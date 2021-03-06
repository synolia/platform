/*jslint nomen:true*/
/*global define*/
define(function (require) {
    'use strict';

    var ActivityListView,
        $ = require('jquery'),
        _ = require('underscore'),
        __ = require('orotranslation/js/translator'),
        routing = require('routing'),
        mediator = require('oroui/js/mediator'),
        LoadingMask = require('oroui/js/loading-mask'),
        DialogWidget = require('oro/dialog-widget'),
        DeleteConfirmation = require('oroui/js/delete-confirmation'),
        BaseCollectionView = require('oroui/js/app/views/base/collection-view');

    ActivityListView = BaseCollectionView.extend({
        options: {
            configuration: {},
            template: null,
            itemTemplate: null,
            itemViewIdPrefix: 'activity-',
            listSelector: '.items.list-box',
            fallbackSelector: '.no-data',
            loadingSelector: '.loading-mask',
            collection: null,
            urls: {
                viewItem: null,
                updateItem: null,
                deleteItem: null
            },
            messages: {}
        },
        listen: {
            'toView collection': '_viewItem',
            'toEdit collection': '_editItem',
            'toDelete collection': '_deleteItem'
        },

        initialize: function (options) {
            this.options = _.defaults(options || {}, this.options);

            _.defaults(this.options.messages, {
                editDialogTitle: __('oro.activitylist.edit_title'),
                itemSaved: __('oro.activitylist.item_saved'),
                itemRemoved: __('oro.activitylist.item_removed'),

                deleteConfirmation: __('oro.activitylist.delete_confirmation'),
                deleteItemError: __('oro.activitylist.delete_error'),

                loadItemsError: __('oro.activitylist.load_error'),
                forbiddenError: __('oro.activitylist.forbidden_error')
            });

            this.template = _.template($(this.options.template).html());

            /**
             * on adding activity item listen to "widget:doRefresh:activity-list-widget"
             */
            mediator.on('widget:doRefresh:activity-list-widget', this._reload, this );

            /**
             * on editing activity item listen to "widget_success:activity_list:item:update"
             */
            mediator.on('widget_success:activity_list:item:update', this._reload, this);

            ActivityListView.__super__.initialize.call(this, options);

            this._initPager();
        },

        /**
         * @inheritDoc
         */
        dispose: function () {
            if (this.disposed) {
                return;
            }

            delete this.itemEditDialog;
            delete this.$loadingMaskContainer;

            mediator.off('widget:doRefresh:activity-list-widget', this._reload, this );
            mediator.off('widget_success:activity_list:item:update', this._reload, this);

            ActivityListView.__super__.dispose.call(this);
        },

        render: function () {
            ActivityListView.__super__.render.apply(this, arguments);
            this.$loadingMaskContainer = this.$('.loading-mask');
            this._initActionMenus();
            return this;
        },

        refresh: function () {
            this.collection.setPage(1);
            this._setPageNumber();
            this._reload();
        },

        _initActionMenus: function () {
            $('.activity-list .dropdown-toggle').unbind('mouseover').bind('mouseover', function () {
                $(this).trigger('click');
            });
            $('.activity-list .dropdown-menu').unbind('mouseleave').bind('mouseleave', function () {
                $(this).parent().find('a.dropdown-toggle').trigger('click');
            });
        },

        _initPager: function () {
            if (this.collection.getPageSize() < this.collection.getCount()) {
                this._toggleNext(true);
            } else {
                this._toggleNext();
            }
            $('.activity-list-widget .pagination-total-num').html(this.collection.pager.total);
            $('.activity-list-widget .pagination-total-count').html(this.collection.getCount());
        },

        goto_previous: function () {
            var currentPage = this.collection.getPage();
            if (currentPage > 1) {
                var nextPage = currentPage - 1;
                this.collection.setPage(nextPage);
                if (nextPage == 1) {
                    this._togglePrevious();
                }

                if (this.collection.pager.total > 1) {
                    this._toggleNext(true);
                } else {
                    this._toggleNext();
                }

                this._setPageNumber(nextPage);
                this._reload();
            }
        },

        goto_page: function (e) {
            var that = this.list,
                currentPage = that.collection.getPage(),
                maxPage = that.collection.pager.total,
                nextPage = parseInt($(e.target).val());

            if (_.isNaN(nextPage) || nextPage <= 0 || nextPage > maxPage || nextPage == currentPage) {
                $(e.target).val(currentPage);
                return;
            }

            that._togglePrevious(true);
            that._toggleNext(true);

            if (nextPage == 1) {
                that._togglePrevious();
            }
            if (nextPage == maxPage) {
                that._toggleNext();
            }

            that.collection.setPage(nextPage);
            that._setPageNumber(nextPage);
            that._reload();
        },

        goto_next: function () {
            var currentPage = this.collection.getPage();
            if (currentPage < this.collection.pager.total) {
                var nextPage = currentPage + 1;
                this.collection.setPage(nextPage);
                if (nextPage == this.collection.pager.total) {
                    this._toggleNext();
                } else {
                    this._toggleNext(true);
                }
                this._togglePrevious(true);

                this._setPageNumber(nextPage);
                this._reload();
            }
        },

        _setPageNumber: function (pageNumber) {
            if (_.isUndefined(pageNumber)) {
                pageNumber = 1;
            }
            $('.activity-list-widget .pagination-current').val(pageNumber);
        },

        _togglePrevious: function (enable) {
            if (_.isUndefined(enable)) {
                $('.activity-list-widget .pagination-previous').addClass('disabled');
            } else {
                $('.activity-list-widget .pagination-previous').removeClass('disabled');
            }
        },

        _toggleNext: function (enable) {
            if (_.isUndefined(enable)) {
                $('.activity-list-widget .pagination-next').addClass('disabled');
            } else {
                $('.activity-list-widget .pagination-next').removeClass('disabled');
            }
        },

        _reload: function () {
            this._showLoading();
            try {
                this.collection.fetch({
                    reset: true,
                    success: _.bind(function () {
                        this._hideLoading();
                        this._initActionMenus();
                        this._initPager();
                    }, this),
                    error: _.bind(function (collection, response) {
                        this._showLoadItemsError(response.responseJSON || {});
                    }, this)
                });
            } catch (err) {
                this._showLoadItemsError(err);
            }
        },

        _viewItem: function (model, modelView) {
            var that = this,
                currentModel = model,
                currentModelView = modelView,
                options = {
                    url: this._getUrl('itemView', model),
                    type: 'get',
                    dataType: 'html',
                    data: {
                        _widgetContainer: 'dialog'
                    }
                };

            if (currentModel.get('is_loaded') !== true) {
                this._showLoading();
                Backbone.$.ajax(options)
                    .done(function (data) {
                        var response = $('<html />').html(data);
                        currentModel.set('is_loaded', true);
                        currentModel.set('contentHTML', $(response).find('.widget-content').html());

                        that._hideLoading();

                        currentModelView.toggle();
                        that._initActionMenus();
                    })
                    .fail(_.bind(this._showLoadItemsError, this));
            } else {
                currentModelView.toggle();
            }
        },

        _editItem: function (model) {
            if (!this.itemEditDialog) {
                this.itemEditDialog = new DialogWidget({
                    'url': this._getUrl('itemEdit', model),
                    'title': model.get('subject'),
                    'regionEnabled': false,
                    'incrementalPosition': false,
                    'alias': 'activity_list:item:update',
                    'dialogOptions': {
                        'modal': true,
                        'resizable': false,
                        'width': 675,
                        'autoResize': true,
                        'close': _.bind(function () {
                            delete this.itemEditDialog;
                        }, this)
                    }
                });

                this.itemEditDialog.render();
            }
        },

        _deleteItem: function (model) {
            var confirm = new DeleteConfirmation({
                content: this._getMessage('deleteConfirmation')
            });
            confirm.on('ok', _.bind(function () {
                this._onItemDelete(model);
            }, this));
            confirm.open();
        },

        _onItemDelete: function (model) {
            this._showLoading();
            try {
                model.destroy({
                    wait: true,
                    url: this._getUrl('itemDelete', model),
                    success: _.bind(function () {
                        mediator.execute('showFlashMessage', 'success', this._getMessage('itemRemoved'));
                        this._reload();
                    }, this),
                    error: _.bind(function (model, response) {
                        if (!_.isUndefined(response.status) && response.status === 403) {
                            this._showForbiddenError(response.responseJSON || {});
                        } else {
                            this._showDeleteItemError(response.responseJSON || {});
                        }
                        this._hideLoading();
                    }, this)
                });
            } catch (err) {
                this._showDeleteItemError(err);
                this._hideLoading();
            }
        },

        /**
         * Fetches url for certain action
         *
         * @param {string} actionKey
         * @param {Backbone.Model=}model
         * @returns {string}
         * @protected
         */
        _getUrl: function (actionKey, model) {
            var className = model.get('relatedActivityClass').replace(/\\/g, '_');
            var route = this.options.configuration[className].routes[actionKey];
            return routing.generate(route, {'id': model.get('relatedActivityId')});
        },

        _getMessage: function (labelKey) {
            return this.options.messages[labelKey];
        },

        _showLoading: function () {
            if (!this.$loadingMaskContainer.data('loading-mask-visible')) {
                this.loadingMask = new LoadingMask();
                this.$loadingMaskContainer.data('loading-mask-visible', true);
                this.$loadingMaskContainer.append(this.loadingMask.render().$el);
                this.loadingMask.show();
            }
        },

        _hideLoading: function () {
            if (this.loadingMask) {
                this.$loadingMaskContainer.data('loading-mask-visible', false);
                this.loadingMask.remove();
                this.loadingMask = null;
            }
        },

        _showLoadItemsError: function (err) {
            this._showError(this.options.messages.loadItemsError, err);
        },

        _showDeleteItemError: function (err) {
            this._showError(this.options.messages.deleteItemError, err);
        },

        _showForbiddenError: function (err) {
            this._showError(this.options.messages.forbiddenError, err);
        },

        _showError: function (message, err) {
            this._hideLoading();
            mediator.execute('showErrorMessage', message, err);
        }
    });

    return ActivityListView;
});
