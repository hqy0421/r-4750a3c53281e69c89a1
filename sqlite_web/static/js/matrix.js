/*
 * Editable attribute matrix. Each cell carries its record token and a
 * fingerprint of the value as rendered; the server refuses to write over
 * a cell whose underlying record changed since the page was rendered and
 * asks for a reload instead.
 */
(function($) {
    'use strict';

    $(function() {
        var $table = $('#matrix-table');
        if (!$table.length) {
            return;
        }

        var config = {
                row_col: $table.attr('data-row-col'),
                row_cat: $table.attr('data-row-cat'),
                col_col: $table.attr('data-col-col'),
                col_cat: $table.attr('data-col-cat'),
                val_col: $table.attr('data-val-col')
            },
            updateUrl = $table.attr('data-update-url'),
            $modal = $('#matrix-modal'),
            $error = $('#matrix-error'),
            $stale = $('#matrix-stale'),
            $vtype = $('#matrix-vtype'),
            $value = $('#matrix-value'),
            $hint = $('#matrix-value-hint'),
            $remove = $('#matrix-remove'),
            $cell = null;

        var hints = {
            text: 'Stored as-is. An empty input writes an empty string, not NULL.',
            integer: 'Whole number, e.g. 42.',
            real: 'Floating-point number, e.g. 3.5.',
            blob: 'Enter the bytes as ' + $vtype.find('option[value="blob"]').text().replace(/^Blob \((.*)\)$/, '$1') + '.',
            null: 'Writes SQL NULL. The record itself is kept; use Remove record to delete it.'
        };

        function syncValueInput() {
            var isNull = $vtype.val() === 'null';
            $value.prop('disabled', isNull);
            $hint.text(hints[$vtype.val()] || '');
        }

        function locationText($c) {
            var rowLabel = $c.closest('tr').find('th').first().text(),
                colLabel = $table.find('thead th').eq($c.index()).text();
            return rowLabel + ' × ' + colLabel;
        }

        function openEditor($c) {
            $cell = $c;
            $('#matrix-cell-loc').text(locationText($c));
            $error.hide();
            $stale.hide();
            $vtype.val($c.attr('data-vtype') || 'text');
            $value.val($c.attr('data-value') || '');
            $remove.toggle(!!$c.attr('data-record'));
            syncValueInput();
            $modal.modal({keyboard: true});
        }

        function applyState(cell) {
            $cell.attr('data-record', cell.record);
            $cell.attr('data-base', cell.base);
            $cell.attr('data-vtype', cell.vtype);
            $cell.attr('data-value', cell.text);
            $cell.removeClass('matrix-has-record matrix-no-record matrix-text ' +
                              'matrix-integer matrix-real matrix-blob matrix-null');
            $cell.addClass(cell.has_record
                ? 'matrix-has-record matrix-' + cell.vtype
                : 'matrix-no-record');
            $cell.html(cell.display);
            $cell.addClass('matrix-saved');
            setTimeout(function() { $cell.removeClass('matrix-saved'); }, 900);
        }

        function fail(resp) {
            if (resp && resp.stale) {
                $error.hide();
                $stale.show();
                $cell.addClass('matrix-stale');
            } else {
                $stale.hide();
                $error.text((resp && resp.error) || 'The request failed.').show();
            }
        }

        function post(payload) {
            $.ajax({
                url: updateUrl,
                method: 'POST',
                data: $.extend({}, config, payload),
                success: function(resp) {
                    applyState(resp.cell);
                    $modal.modal('hide');
                },
                error: function(xhr) {
                    fail(xhr.responseJSON);
                }
            });
        }

        function cellPayload(action) {
            return {
                action: action,
                row_key: $cell.attr('data-row-key'),
                col_key: $cell.attr('data-col-key'),
                record: $cell.attr('data-record') || '',
                base: $cell.attr('data-base') || ''
            };
        }

        $table.on('click', 'td.matrix-editable', function() {
            openEditor($(this));
        });
        $vtype.on('change', syncValueInput);
        $('#matrix-save').on('click', function() {
            var payload = cellPayload('save');
            payload.vtype = $vtype.val();
            payload.value = $value.val();
            post(payload);
        });
        $remove.on('click', function() {
            if (!window.confirm('Delete the record for this cell? The cell becomes empty.')) {
                return;
            }
            post(cellPayload('remove'));
        });
        $('#matrix-reload').on('click', function(e) {
            e.preventDefault();
            window.location.reload();
        });
    });
})(jQuery);
