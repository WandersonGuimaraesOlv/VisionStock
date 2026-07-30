import React from 'react';
import { Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import { SortDown, SortUp, X } from 'react-bootstrap-icons';

const FilterControls = ({
  filters,
  onFilterChange,
  onResetFilters,
  sortConfig,
  onSortChange,
  itemsCount,
}) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const handleSortFieldChange = (e) => {
    onSortChange({ ...sortConfig, field: e.target.value });
  };

  const toggleSortOrder = () => {
    onSortChange({ ...sortConfig, order: sortConfig.order === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <div className="my-3 p-3 border rounded bg-white shadow-sm text-start" style={{ borderColor: '#dee2e6' }}>
      <Row className="g-2 align-items-end">
        <Col xl={3} lg={3} md={4} xs={12}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted mb-1">Material / SKU</Form.Label>
            <Form.Control
              type="text"
              name="material"
              value={filters.material || ''}
              onChange={handleInputChange}
              placeholder="Buscar por código ou descrição..."
              size="sm"
            />
          </Form.Group>
        </Col>

        <Col xl={2} lg={2} md={4} xs={6}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted mb-1">Status</Form.Label>
            <Form.Select
              name="status"
              value={filters.status || ''}
              onChange={handleInputChange}
              size="sm"
            >
              <option value="">Todos</option>
              <option value="OK">OK</option>
              <option value="FALTA">Divergência (Falta)</option>
              <option value="SOBRA">Divergência (Sobra)</option>
              <option value="LOCAL_INCORRETO">Local Incorreto</option>
              <option value="NAO_ENCONTRADO">Não Encontrado</option>
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xl={2} lg={2} md={4} xs={6}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted mb-1">Depósito</Form.Label>
            <Form.Control
              type="text"
              name="deposito"
              value={filters.deposito || ''}
              onChange={handleInputChange}
              placeholder="Depósito..."
              size="sm"
            />
          </Form.Group>
        </Col>

        <Col xl={3} lg={3} md={6} xs={12}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted mb-1">Ordenar por</Form.Label>
            <InputGroup size="sm">
              <Form.Select
                name="sortField"
                value={sortConfig.field}
                onChange={handleSortFieldChange}
              >
                <option value="material">Material (SKU)</option>
                <option value="status">Status</option>
                <option value="deposito">Depósito</option>
              </Form.Select>
              <Button variant="outline-secondary" onClick={toggleSortOrder}>
                {sortConfig.order === 'asc' ? <SortUp /> : <SortDown />}
              </Button>
            </InputGroup>
          </Form.Group>
        </Col>

        <Col xl="auto" lg={2} md={2} xs={12} className="d-flex align-items-end ms-auto">
          <Button variant="outline-danger" onClick={onResetFilters} size="sm" className="w-100 d-flex align-items-center justify-content-center gap-1">
            <X size={18} /> Limpar
          </Button>
        </Col>
      </Row>

      <div className="text-end mt-2 text-muted small">
        <strong>{itemsCount}</strong> {itemsCount === 1 ? 'item encontrado' : 'itens encontrados'}
      </div>
    </div>
  );
};

export default FilterControls;