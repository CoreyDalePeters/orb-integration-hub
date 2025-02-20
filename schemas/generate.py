# files: schemas/generate.py
# author: Corey Dale Peters
# date: 2025-02-20
# description: This file is used to generate TypeScript, Python, and GraphQL schema models from schema files
# defined in index.yml.

# Standard library imports
import os
import sys
import logging
from pathlib import Path

# 3rd party imports
import yaml
from jinja2 import Template, Environment, FileSystemLoader

# Set up logging
logger = logging.getLogger('schema_generator')
logger.setLevel(logging.INFO)

# Create handlers
console_handler = logging.StreamHandler(sys.stdout)
file_handler = logging.FileHandler('schema_generator.log')

# Create formatters and add to handlers
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
console_handler.setFormatter(logging.Formatter(log_format))
file_handler.setFormatter(logging.Formatter(log_format))

# Add handlers to logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def setup_jinja_env():
    """
    Set up the Jinja environment.

    :return: Configured Jinja environment
    """
    # Create Jinja environment
    env = Environment(loader=FileSystemLoader(os.path.join(SCRIPT_DIR, 'templates')))
    return env


def load_template(template_path, jinja_env=None):
    """
    Load a template from the templates directory.

    :param template_path: Path to the template file
    :param jinja_env: Optional Jinja environment to use
    :return: Template content as string
    :raises FileNotFoundError: If template file doesn't exist
    :raises Exception: For any other errors during file reading
    """
    # If using a Jinja environment, use it to load the template
    if jinja_env:
        template_name = os.path.basename(template_path)
        try:
            template = jinja_env.get_template(template_name)
            logger.debug("Successfully loaded template: %s using Jinja env", template_name)
            return template
        except Exception as e:
            logger.error("Error loading template %s with Jinja env: %s", template_name, str(e))
            raise

    # Otherwise, load the template directly
    full_path = os.path.join(SCRIPT_DIR, template_path)
    try:
        with open(full_path, 'r') as file:
            template_content = file.read()
            logger.debug("Successfully loaded template: %s", full_path)
            return Template(template_content)
    except FileNotFoundError:
        logger.error("Template file not found: %s", full_path)
        raise
    except Exception as e:
        logger.error("Error loading template %s: %s", full_path, str(e))
        raise


def load_schema(schema_path):
    """
    Load and parse a YAML schema file.

    :param schema_path: Path to the schema file
    :return: Parsed schema as dictionary
    :raises yaml.YAMLError: If schema contains invalid YAML
    :raises FileNotFoundError: If schema file doesn't exist
    :raises Exception: For any other errors during file reading or parsing
    """
    # Resolve the schema path relative to script directory
    full_path = os.path.join(SCRIPT_DIR, schema_path)
    try:
        with open(full_path, 'r') as file:
            schema = yaml.safe_load(file)
            logger.debug("Successfully loaded schema from %s", full_path)
            return schema
    except FileNotFoundError:
        logger.error("Schema file not found: %s", full_path)
        raise
    except yaml.YAMLError as e:
        logger.error("Invalid YAML in schema %s: %s", full_path, str(e))
        raise
    except Exception as e:
        logger.error("Error loading schema %s: %s", full_path, str(e))
        raise


def load_index():
    """
    Load the index.yml file which contains the registry of all schemas.

    :return: Parsed index as dictionary
    :raises: Various exceptions handled by load_schema()
    """
    logger.info("Loading schema registry from index.yml")
    return load_schema('index.yml')


def generate_typescript_model(table_name, schema_path, jinja_env):
    """
    Generate TypeScript model from schema.

    Reads the schema, applies the TypeScript template, and writes
    the result to the appropriate location in the frontend directory.

    :param table_name: Name of the table/model to generate
    :param schema_path: Path to the schema file
    :param jinja_env: Jinja environment
    :return: Boolean indicating success or failure
    """
    logger.info("Starting TypeScript model generation for '%s'", table_name)

    try:
        # Load the schema file
        schema = load_schema(schema_path)
        logger.debug("Loaded schema from %s", schema_path)

        # Convert table_name to proper model name - singular and capitalized
        # 'roles' -> 'Role', 'users' -> 'User', etc.
        if table_name.endswith('s'):
            model_name = table_name[:-1].capitalize()
            model_file_name = table_name[:-1]  # for filename, use singular but don't capitalize
        else:
            model_name = table_name.capitalize()
            model_file_name = table_name  # for filename, use as-is if not plural

        logger.debug("Using model name '%s' for table '%s'", model_name, table_name)

        # Extract the model - check for new structure format
        if 'model' in schema and 'attributes' in schema['model']:
            # New structure with top-level 'model' key
            model = schema['model']
            logger.debug("Found model attributes using new schema structure")
        elif 'models' in schema and model_name in schema['models']:
            # Old structure with 'models.ModelName' format
            model = schema['models'][model_name]
            logger.debug("Found model attributes using old schema structure")
        else:
            logger.error("Schema missing required model definition. Checked both 'model' and 'models.%s'", model_name)
            return False

        logger.debug("Model has %d attributes", len(model.get('attributes', {})))

        # Load the TypeScript template
        template = load_template('typescript_model.jinja', jinja_env)

        # Render the template with model data
        ts_code = template.render(
            model_name=model_name,
            attributes=model['attributes']
        )
        logger.debug("Successfully rendered TypeScript template")

        # Prepare output location - create file name based on singular form
        output_dir = Path('../frontend/src/app/core/models')
        output_file = output_dir / f"{model_file_name}.model.ts"

        # Ensure directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.debug("Ensured output directory exists: %s", output_dir)

        # Write the generated code to file
        with open(output_file, 'w') as f:
            f.write(ts_code)

        logger.info("TypeScript model successfully generated: %s", output_file)
        return True

    except KeyError as e:
        logger.error("Schema missing required key: %s", str(e))
        return False
    except Exception as e:
        logger.error("Error generating TypeScript model for '%s': %s", table_name, str(e), exc_info=True)
        return False


def generate_python_model(table_name, schema_path, jinja_env):
    """
    Generate Python model from schema.

    Reads the schema, applies the Python template, and writes
    the result to the appropriate location in the backend directory.

    :param table_name: Name of the table/model to generate
    :param schema_path: Path to the schema file
    :param jinja_env: Jinja environment
    :return: Boolean indicating success or failure
    """
    logger.info("Starting Python model generation for '%s'", table_name)

    try:
        # Load the schema file
        schema = load_schema(schema_path)
        logger.debug("Loaded schema from %s", schema_path)

        # Convert table_name to proper model name - singular and capitalized
        # 'roles' -> 'Role', 'users' -> 'User', etc.
        if table_name.endswith('s'):
            model_name = table_name[:-1].capitalize()
            model_file_name = table_name[:-1]  # for filename, use singular but don't capitalize
        else:
            model_name = table_name.capitalize()
            model_file_name = table_name  # for filename, use as-is if not plural

        logger.debug("Using model name '%s' for table '%s'", model_name, table_name)

        # Extract the model - check for new structure format
        if 'model' in schema and 'attributes' in schema['model']:
            # New structure with top-level 'model' key
            model = schema['model']
            logger.debug("Found model attributes using new schema structure")
        elif 'models' in schema and model_name in schema['models']:
            # Old structure with 'models.ModelName' format
            model = schema['models'][model_name]
            logger.debug("Found model attributes using old schema structure")
        else:
            logger.error("Schema missing required model definition. Checked both 'model' and 'models.%s'", model_name)
            return False

        logger.debug("Model has %d attributes", len(model.get('attributes', {})))

        # Load the Python template
        template = load_template('python_model.jinja', jinja_env)

        # Render the template with model data
        py_code = template.render(
            model_name=model_name,
            attributes=model['attributes']
        )
        logger.debug("Successfully rendered Python template")

        # Prepare output location - using singular form for file name
        output_dir = Path('../backend/src/models')
        output_file = output_dir / f"{model_file_name}.py"

        # Ensure directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.debug("Ensured output directory exists: %s", output_dir)

        # Write the generated code to file
        with open(output_file, 'w') as f:
            f.write(py_code)

        logger.info("Python model successfully generated: %s", output_file)
        return True

    except KeyError as e:
        logger.error("Schema missing required key: %s", str(e))
        return False
    except Exception as e:
        logger.error("Error generating Python model for '%s': %s", table_name, str(e), exc_info=True)
        return False


def generate_graphql_schema(table_name, schema_path, jinja_env):
    """
    Generate GraphQL schema fragment from model definition.

    :param table_name: Name of the table/model to generate
    :param schema_path: Path to the schema file
    :param jinja_env: Jinja environment
    :return: Boolean indicating success or failure
    """
    logger.info("Starting GraphQL schema generation for '%s'", table_name)

    try:
        # Load the schema file
        schema = load_schema(schema_path)
        logger.debug("Loaded schema from %s", schema_path)

        # Convert table_name to proper model name - singular and capitalized
        if table_name.endswith('s'):
            model_name = table_name[:-1].capitalize()
            model_file_name = table_name[:-1]  # for filename, use singular
        else:
            model_name = table_name.capitalize()
            model_file_name = table_name  # for filename, use as-is

        logger.debug("Using model name '%s' for table '%s'", model_name, table_name)

        # Extract the model
        if 'model' in schema and 'attributes' in schema['model']:
            model = schema['model']
            logger.debug("Found model attributes using new schema structure")
        elif 'models' in schema and model_name in schema['models']:
            model = schema['models'][model_name]
            logger.debug("Found model attributes using old schema structure")
        else:
            logger.error("Schema missing required model definition")
            return False

        # Load the GraphQL schema template
        template = load_template('graphql_schema.jinja', jinja_env)

        # Render the template with model data
        gql_schema = template.render(
            model_name=model_name,
            model_name_lowercase=model_name.lower(),
            attributes=model['attributes'],
            partition_key=model.get('partition_key', ''),
            sort_key=model.get('sort_key', '')
        )

        # Prepare output location matching your directory structure
        output_dir = Path('../backend/infrastructure/cloudformation/schemas')
        output_file = output_dir / f"{model_file_name}.graphql"

        # Ensure directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.debug("Ensured output directory exists: %s", output_dir)

        # Write the generated schema to file
        with open(output_file, 'w') as f:
            f.write(gql_schema)

        logger.info("GraphQL schema successfully generated: %s", output_file)
        return True

    except Exception as e:
        logger.error("Error generating GraphQL schema: %s", str(e), exc_info=True)
        return False


def generate_appsync_imports():
    """
    Generate the AppSync imports file for the main schema.

    :return: Boolean indicating success or failure
    """
    logger.info("Generating AppSync imports file")

    try:
        # Load the index
        index = load_index()

        if 'schema_registry' not in index and 'schemaRegistry' in index:
            index['schema_registry'] = index['schemaRegistry']

        if 'schema_registry' not in index or 'tables' not in index['schema_registry']:
            logger.error("Invalid index.yml: missing schema_registry.tables section")
            return False

        tables = index['schema_registry']['tables']

        # Generate import statements with no quotes, just as AppSync expects
        import_statements = []
        for table in tables:
            table_name = table.get('name')
            if not table_name:
                continue

            # Convert to singular if plural
            if table_name.endswith('s'):
                model_name = table_name[:-1]
            else:
                model_name = table_name

            # Use AppSync import syntax without quotes
            import_statements.append(f'#import schemas/{model_name}.graphql')

        # Prepare output location
        output_dir = Path('../backend/infrastructure/cloudformation')
        output_file = output_dir / "imports.graphql"

        # Ensure directory exists
        output_dir.mkdir(parents=True, exist_ok=True)

        # Write the imports file
        with open(output_file, 'w') as f:
            f.write('\n'.join(import_statements))

        logger.info("AppSync imports file successfully generated: %s", output_file)
        return True

    except Exception as e:
        logger.error("Error generating AppSync imports file: %s", str(e), exc_info=True)
        return False

def main():
    """
    Main function - loads the index and generates models for all tables.

    :return: None
    """
    logger.info("=============== SCHEMA GENERATION STARTED ===============")

    try:
        # Set up Jinja environment
        jinja_env = setup_jinja_env()
        logger.debug("Jinja environment set up")

        # Load the schema registry from index.yml
        index = load_index()

        if 'schema_registry' not in index and 'schemaRegistry' in index:
            # Handle camelCase in index.yml
            index['schema_registry'] = index['schemaRegistry']

        if 'schema_registry' not in index or 'tables' not in index['schema_registry']:
            logger.error("Invalid index.yml: missing schema_registry.tables section")
            sys.exit(1)

        tables = index['schema_registry']['tables']
        logger.info("Found %d tables in schema registry", len(tables))

        # Track successful generations
        success_count_ts = 0
        success_count_py = 0
        success_count_gql = 0
        failed_tables = []

        # Process each table in the registry
        for table in tables:
            table_name = table.get('name')
            schema_path = table.get('path')

            if not table_name or not schema_path:
                logger.warning("Skipping invalid table entry: %s", table)
                continue

            logger.info("Processing table: %s (schema: %s)", table_name, schema_path)

            # Generate TypeScript model
            ts_success = generate_typescript_model(table_name, schema_path, jinja_env)
            if ts_success:
                success_count_ts += 1

            # Generate Python model
            py_success = generate_python_model(table_name, schema_path, jinja_env)
            if py_success:
                success_count_py += 1

            # Generate GraphQL schema
            gql_success = generate_graphql_schema(table_name, schema_path, jinja_env)
            if gql_success:
                success_count_gql += 1

            # Track failed generations
            if not (ts_success and py_success and gql_success):
                failed_tables.append(table_name)

        # Generate AppSync imports file
        imports_success = generate_appsync_imports()

        # Report results
        total_tables = len(tables)
        logger.info("=============== GENERATION SUMMARY ===============")
        logger.info("Total tables processed: %d", total_tables)
        logger.info("TypeScript models generated: %d of %d", success_count_ts, total_tables)
        logger.info("Python models generated: %d of %d", success_count_py, total_tables)
        logger.info("GraphQL schemas generated: %d of %d", success_count_gql, total_tables)
        logger.info("AppSync imports file generated: %s", "Yes" if imports_success else "No")

        if failed_tables:
            logger.error("Failed generations for tables: %s", ", ".join(failed_tables))
            logger.error("=============== SCHEMA GENERATION COMPLETED WITH ERRORS ===============")
            sys.exit(1)
        else:
            logger.info("=============== SCHEMA GENERATION COMPLETED SUCCESSFULLY ===============")
            sys.exit(0)

    except Exception as e:
        logger.error("Unexpected error during schema generation: %s", str(e), exc_info=True)
        logger.error("=============== SCHEMA GENERATION FAILED ===============")
        sys.exit(1)


if __name__ == "__main__":
    main()