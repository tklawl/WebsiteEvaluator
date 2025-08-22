const { logger } = require('./logger');

function validateRequest(body) {
  const errors = [];

  // Check if body exists
  if (!body || typeof body !== 'object') {
    errors.push('Request body is required and must be an object');
    return { isValid: false, errors };
  }

  // Validate websiteUrl
  if (!body.websiteUrl || typeof body.websiteUrl !== 'string') {
    errors.push('websiteUrl is required and must be a string');
  } else {
    try {
      new URL(body.websiteUrl);
    } catch (error) {
      errors.push('websiteUrl must be a valid URL');
    }
  }

  // Validate selectedSections
  if (!Array.isArray(body.selectedSections) || body.selectedSections.length === 0) {
    errors.push('selectedSections is required and must be a non-empty array');
  } else {
    const maxSections = parseInt(process.env.MAX_SECTIONS_PER_REQUEST) || 10;
    if (body.selectedSections.length > maxSections) {
      errors.push(`selectedSections cannot exceed ${maxSections} sections`);
    }

    body.selectedSections.forEach((section, index) => {
      if (!section || typeof section !== 'object') {
        errors.push(`selectedSections[${index}] must be an object`);
        return;
      }

      if (!section.selector || typeof section.selector !== 'string') {
        errors.push(`selectedSections[${index}].selector is required and must be a string`);
      }

      if (!section.title || typeof section.title !== 'string') {
        errors.push(`selectedSections[${index}].title is required and must be a string`);
      }

      if (!section.content || typeof section.content !== 'string') {
        errors.push(`selectedSections[${index}].content is required and must be a string`);
      }

      // Check content length
      const maxContentLength = parseInt(process.env.MAX_CONTENT_LENGTH) || 50000;
      if (section.content.length > maxContentLength) {
        errors.push(`selectedSections[${index}].content exceeds maximum length of ${maxContentLength} characters`);
      }
    });
  }

  // Validate criteria
  if (!Array.isArray(body.criteria) || body.criteria.length === 0) {
    errors.push('criteria is required and must be a non-empty array');
  } else {
    body.criteria.forEach((criterion, index) => {
      if (!criterion || typeof criterion !== 'object') {
        errors.push(`criteria[${index}] must be an object`);
        return;
      }

      if (!criterion.id || typeof criterion.id !== 'string') {
        errors.push(`criteria[${index}].id is required and must be a string`);
      }

      if (!criterion.name || typeof criterion.name !== 'string') {
        errors.push(`criteria[${index}].name is required and must be a string`);
      }

      if (criterion.definition && typeof criterion.definition !== 'string') {
        errors.push(`criteria[${index}].definition must be a string if provided`);
      }

      if (criterion.selected !== undefined && typeof criterion.selected !== 'boolean') {
        errors.push(`criteria[${index}].selected must be a boolean if provided`);
      }
    });
  }

  // Check total content length
  if (body.selectedSections && Array.isArray(body.selectedSections)) {
    const totalContentLength = body.selectedSections.reduce((total, section) => {
      return total + (section.content ? section.content.length : 0);
    }, 0);

    const maxTotalLength = parseInt(process.env.MAX_CONTENT_LENGTH) || 50000;
    if (totalContentLength > maxTotalLength) {
      errors.push(`Total content length (${totalContentLength}) exceeds maximum allowed (${maxTotalLength})`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function sanitizeInput(body) {
  const sanitized = { ...body };

  // Sanitize websiteUrl
  if (sanitized.websiteUrl) {
    sanitized.websiteUrl = sanitized.websiteUrl.trim();
  }

  // Sanitize selectedSections
  if (Array.isArray(sanitized.selectedSections)) {
    sanitized.selectedSections = sanitized.selectedSections.map(section => ({
      selector: section.selector ? section.selector.trim() : '',
      title: section.title ? section.title.trim() : '',
      content: section.content ? section.content.trim() : ''
    }));
  }

  // Sanitize criteria
  if (Array.isArray(sanitized.criteria)) {
    sanitized.criteria = sanitized.criteria.map(criterion => ({
      id: criterion.id ? criterion.id.trim() : '',
      name: criterion.name ? criterion.name.trim() : '',
      definition: criterion.definition ? criterion.definition.trim() : '',
      selected: criterion.selected === true
    }));
  }

  return sanitized;
}

module.exports = {
  validateRequest,
  sanitizeInput
};
